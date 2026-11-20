package utp.edu.pe.cruce_horarios.controller;

import utp.edu.pe.cruce_horarios.model.Horario;
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import utp.edu.pe.cruce_horarios.repository.ReprogramacionRepository;
import utp.edu.pe.cruce_horarios.service.CruceHorarioService;
import utp.edu.pe.cruce_horarios.service.NeonSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/horarios")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8082"})
@Tag(name = "Módulo de Horarios y Reprogramaciones", description = "Endpoints para la consulta de horarios, disponibilidad presencial y validación de reprogramaciones")
public class HorarioController {

    @Autowired
    private HorarioRepository horarioRepository;

    @Autowired
    private ReprogramacionRepository reprogramacionRepository;

    @Autowired
    private MatriculaRepository matriculaRepository;

    @Autowired
    private CruceHorarioService cruceHorarioService;

    @Autowired(required = false)
    private NeonSyncService neonSyncService;

    @Operation(summary = "GET /api/horarios/{codigo}", description = "Recupera la lista completa de horarios académicos asignados a un docente")
    @GetMapping("/{codigo}")
    public List<Horario> listarHorarios(@PathVariable String codigo) {
        return horarioRepository.findByDocenteCodigo(codigo);
    }

    @Operation(summary = "POST /api/horarios", description = "Valida reglas académicas (07:00-22:30, bloques de 45 min, traslado 15 min) e inserta un nuevo horario regular")
    @PostMapping
    public ResponseEntity<?> registrarHorario(@RequestBody Horario horario) {
        if (horario.getAula() != null && !horario.getAula().isBlank()) {
            horario.setAula(horario.getAula().trim().toUpperCase());
        }
        Optional<String> error = cruceHorarioService.validarHorarioRegular(horario);
        if (error.isPresent()) {
            return ResponseEntity.badRequest().body(error.get());
        }
        return ResponseEntity.ok(horarioRepository.save(horario));
    }

    @Operation(summary = "GET /api/horarios/estudiantes/{codigo}", description = "Recupera la lista de horarios académicos de un estudiante a partir de sus cursos matriculados")
    @GetMapping("/estudiantes/{codigo}")
    public List<Horario> listarHorariosEstudiante(@PathVariable String codigo) {
        return cruceHorarioService.obtenerHorariosEstudiante(codigo);
    }

    @Operation(summary = "POST /api/horarios/reprogramaciones", description = "Valida reglas académicas (07:00-22:30, hora académica 45 min, traslado 15 min, docente y salón), calcula el % de asistencia y persiste la reprogramación")
    @PostMapping(value = "/reprogramaciones")
    public ResponseEntity<String> reprogramar(@RequestBody Reprogramacion reprogramacion) {
        if (reprogramacion.getAula() != null && !reprogramacion.getAula().isBlank()) {
            reprogramacion.setAula(reprogramacion.getAula().trim().toUpperCase());
        }

        Optional<String> reglaIncumplida = cruceHorarioService.validarReglasAcademicas(reprogramacion);
        if (reglaIncumplida.isPresent()) {
            return ResponseEntity.badRequest().body(reglaIncumplida.get());
        }

        CruceHorarioService.DisponibilidadPresencial disp =
                cruceHorarioService.calcularDisponibilidadPresencial(reprogramacion);
        reprogramacion.setPorcentajeAsistencia(disp.porcentajeAsistencia());

        if (reprogramacion.getAula() == null || reprogramacion.getAula().isBlank()) {
            String aulaCurso = horarioRepository.findByCurso(reprogramacion.getCurso()).stream()
                    .map(Horario::getAula)
                    .filter(a -> a != null && !a.isBlank())
                    .findFirst()
                    .orElse("A101");
            reprogramacion.setAula(aulaCurso);
        }
        if (reprogramacion.getEstado() == null || reprogramacion.getEstado().isBlank()) {
            reprogramacion.setEstado("SOLICITADO");
        }
        if (reprogramacion.getMotivo() == null || reprogramacion.getMotivo().isBlank()) {
            reprogramacion.setMotivo("Recuperación programada");
        }

        Reprogramacion guardada = reprogramacionRepository.save(reprogramacion);
        if (neonSyncService != null) {
            neonSyncService.sincronizarReprogramacionInsert(guardada);
        }

        if (disp.conCruce() == 0) {
            return ResponseEntity.ok("Reprogramación registrada sin cruces.");
        }
        return ResponseEntity.ok("Reprogramación registrada (asistencia estimada de estudiantes: "
                + disp.porcentajeAsistencia() + "%).");
    }

    @Operation(summary = "GET /api/horarios/reprogramaciones", description = "Lista todas las reprogramaciones registradas")
    @GetMapping("/reprogramaciones")
    public List<Reprogramacion> listarTodasReprogramaciones() {
        return reprogramacionRepository.findAll();
    }

    @Operation(summary = "PUT /api/horarios/reprogramaciones/{id}/confirmar", description = "Confirma una reprogramación solicitada cambiando su estado a CONFIRMADO")
    @PutMapping("/reprogramaciones/{id}/confirmar")
    public ResponseEntity<Reprogramacion> confirmarReprogramacion(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        return reprogramacionRepository.findById(id)
                .map(reprog -> {
                    reprog.setEstado("CONFIRMADO");
                    if (body != null && body.get("observacion") != null && !body.get("observacion").isBlank()) {
                        reprog.setObservacionCoordinador(body.get("observacion").trim());
                    }
                    Reprogramacion guardada = reprogramacionRepository.save(reprog);
                    if (neonSyncService != null) {
                        neonSyncService.sincronizarReprogramacionEstado(guardada);
                    }
                    return ResponseEntity.ok(guardada);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "PUT /api/horarios/reprogramaciones/{id}/rechazar", description = "Rechaza una solicitud de reprogramación registrando la observación del Coordinador Académico")
    @PutMapping("/reprogramaciones/{id}/rechazar")
    public ResponseEntity<Reprogramacion> rechazarReprogramacion(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        return reprogramacionRepository.findById(id)
                .map(reprog -> {
                    reprog.setEstado("RECHAZADO");
                    String obs = body != null && body.get("observacion") != null && !body.get("observacion").isBlank()
                            ? body.get("observacion").trim()
                            : "Observada por Coordinación Académica";
                    reprog.setObservacionCoordinador(obs);
                    Reprogramacion guardada = reprogramacionRepository.save(reprog);
                    if (neonSyncService != null) {
                        neonSyncService.sincronizarReprogramacionEstado(guardada);
                    }
                    return ResponseEntity.ok(guardada);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "DELETE /api/horarios/reprogramaciones/{id}", description = "Elimina una reprogramación por ID")
    @DeleteMapping("/reprogramaciones/{id}")
    public ResponseEntity<Void> eliminarReprogramacion(@PathVariable Long id) {
        Optional<Reprogramacion> existente = reprogramacionRepository.findById(id);
        if (existente.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        reprogramacionRepository.deleteById(id);
        if (neonSyncService != null) {
            neonSyncService.eliminarReprogramacionNeon(existente.get());
        }
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "GET /api/horarios/matriculas", description = "Lista todas las matrículas registradas")
    @GetMapping("/matriculas")
    public List<Matricula> listarMatriculas() {
        return matriculaRepository.findAll();
    }

    @Operation(summary = "POST /api/horarios/matriculas", description = "Registra la matrícula de un estudiante evitando duplicados en el mismo curso")
    @PostMapping("/matriculas")
    public ResponseEntity<?> registrarMatricula(@RequestBody Matricula matricula) {
        if (matricula.getEstudianteCodigo() == null || matricula.getEstudianteCodigo().isBlank()
                || matricula.getCurso() == null || matricula.getCurso().isBlank()) {
            return ResponseEntity.badRequest().body("Código de estudiante y curso son obligatorios.");
        }
        String estCod = matricula.getEstudianteCodigo().trim().toUpperCase();
        String curso = matricula.getCurso().trim();
        boolean yaMatriculado = matriculaRepository.findByEstudianteCodigo(estCod).stream()
                .anyMatch(m -> curso.equalsIgnoreCase(m.getCurso()));
        if (yaMatriculado) {
            return ResponseEntity.badRequest().body("El estudiante " + estCod + " ya está matriculado en " + curso + ".");
        }
        matricula.setEstudianteCodigo(estCod);
        matricula.setCurso(curso);
        return ResponseEntity.ok(matriculaRepository.save(matricula));
    }

    @Operation(summary = "POST /api/horarios/disponibilidad-presencial", description = "Calcula el porcentaje de estudiantes matriculados que pueden asistir presencialmente a la clase de recuperación")
    @PostMapping("/disponibilidad-presencial")
    public ResponseEntity<CruceHorarioService.DisponibilidadPresencial> calcularDisponibilidadPresencial(
            @RequestBody Reprogramacion reprogramacion) {
        return ResponseEntity.ok(cruceHorarioService.calcularDisponibilidadPresencial(reprogramacion));
    }

    @Operation(summary = "GET /api/horarios/recomendaciones", description = "Evalúa todas las opciones de fecha y hora de recuperación mostrando su porcentaje de asistencia y marcando como recomendadas las mayores al 50%")
    @GetMapping("/recomendaciones")
    public List<CruceHorarioService.OpcionRecuperacion> recomendarOpciones(
            @RequestParam String docenteCodigo,
            @RequestParam String curso) {
        return cruceHorarioService.recomendarOpcionesRecuperacion(docenteCodigo, curso);
    }

    @Operation(summary = "GET /api/horarios", description = "Lista todos los horarios registrados")
    @GetMapping
    public List<Horario> listarTodos() {
        return horarioRepository.findAll();
    }

    @Operation(summary = "GET /api/horarios/reprogramaciones/{codigo}", description = "Lista las reprogramaciones asignadas a un docente")
    @GetMapping("/reprogramaciones/{codigo}")
    public List<Reprogramacion> listarReprogramacionesPorDocente(@PathVariable String codigo) {
        return reprogramacionRepository.findByDocenteCodigo(codigo);
    }

    @Operation(summary = "GET /api/horarios/reprogramaciones/estudiantes/{codigo}", description = "Lista las clases de recuperación de los cursos en los que el estudiante está matriculado")
    @GetMapping("/reprogramaciones/estudiantes/{codigo}")
    public List<Reprogramacion> listarReprogramacionesEstudiante(@PathVariable String codigo) {
        return cruceHorarioService.obtenerReprogramacionesEstudiante(codigo);
    }
}
