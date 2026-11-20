package utp.edu.pe.cruce_horarios.controller;

import utp.edu.pe.cruce_horarios.model.Horario;
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import utp.edu.pe.cruce_horarios.repository.ReprogramacionRepository;
import utp.edu.pe.cruce_horarios.service.CruceHorarioService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/horarios")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8082"})
@Tag(name = "Módulo de Horarios y Reprogramaciones", description = "Endpoints para la consulta de horarios del docente y del estudiante, matrículas y validación de cruces en reprogramaciones")
public class HorarioController {

    @Autowired
    private HorarioRepository horarioRepository;

    @Autowired
    private ReprogramacionRepository reprogramacionRepository;

    @Autowired
    private MatriculaRepository matriculaRepository;

    @Autowired
    private CruceHorarioService cruceHorarioService;

    @Operation(summary = "GET /api/horarios/{codigo}", description = "Recupera la lista completa de horarios académicos asignados a un docente")
    @GetMapping("/{codigo}")
    public List<Horario> listarHorarios(@PathVariable String codigo) {
        return horarioRepository.findByDocenteCodigo(codigo);
    }

    @Operation(summary = "POST /api/horarios", description = "Inserta y persiste un nuevo registro de horario regular de un docente")
    @PostMapping
    public Horario registrarHorario(@RequestBody Horario horario) {
        return horarioRepository.save(horario);
    }

    @Operation(summary = "GET /api/horarios/estudiantes/{codigo}", description = "Recupera la lista de horarios académicos de un estudiante a partir de sus cursos matriculados")
    @GetMapping("/estudiantes/{codigo}")
    public List<Horario> listarHorariosEstudiante(@PathVariable String codigo) {
        return cruceHorarioService.obtenerHorariosEstudiante(codigo);
    }

    @Operation(summary = "POST /api/horarios/reprogramaciones", description = "Procesa una solicitud de cambio de fecha u hora de una sesión de clase y valida posibles cruces del docente, estudiantes y salón")
    @PostMapping(value = "/reprogramaciones")
    public ResponseEntity<String> reprogramar(@RequestBody Reprogramacion reprogramacion) {
        if (reprogramacion.getAula() != null && !reprogramacion.getAula().isBlank()) {
            reprogramacion.setAula(reprogramacion.getAula().trim().toUpperCase());
        }
        Optional<String> mensajeConflicto = cruceHorarioService.obtenerMensajeConflicto(reprogramacion);

        if (mensajeConflicto.isPresent()) {
            return ResponseEntity.badRequest().body(mensajeConflicto.get());
        }

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
        reprogramacionRepository.save(reprogramacion);
        return ResponseEntity.ok("Reprogramación registrada sin cruces.");
    }

    @Operation(summary = "GET /api/horarios/reprogramaciones", description = "Lista todas las reprogramaciones registradas")
    @GetMapping("/reprogramaciones")
    public List<Reprogramacion> listarTodasReprogramaciones() {
        return reprogramacionRepository.findAll();
    }

    @Operation(summary = "PUT /api/horarios/reprogramaciones/{id}/confirmar", description = "Confirma una reprogramación solicitada cambiando su estado a CONFIRMADO")
    @PutMapping("/reprogramaciones/{id}/confirmar")
    public ResponseEntity<Reprogramacion> confirmarReprogramacion(@PathVariable Long id) {
        return reprogramacionRepository.findById(id)
                .map(reprog -> {
                    reprog.setEstado("CONFIRMADO");
                    return ResponseEntity.ok(reprogramacionRepository.save(reprog));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "GET /api/horarios/matriculas", description = "Lista todas las matrículas registradas")
    @GetMapping("/matriculas")
    public List<Matricula> listarMatriculas() {
        return matriculaRepository.findAll();
    }

    @Operation(summary = "POST /api/horarios/matriculas", description = "Registra la matrícula de un estudiante en un curso")
    @PostMapping("/matriculas")
    public Matricula registrarMatricula(@RequestBody Matricula matricula) {
        return matriculaRepository.save(matricula);
    }

    @Operation(summary = "POST /api/horarios/disponibilidad-presencial", description = "Calcula el porcentaje de estudiantes matriculados que pueden asistir presencialmente a la clase de recuperación")
    @PostMapping("/disponibilidad-presencial")
    public ResponseEntity<CruceHorarioService.DisponibilidadPresencial> calcularDisponibilidadPresencial(
            @RequestBody Reprogramacion reprogramacion) {
        return ResponseEntity.ok(cruceHorarioService.calcularDisponibilidadPresencial(reprogramacion));
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
