package utp.edu.pe.cruce_horarios.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import utp.edu.pe.cruce_horarios.model.HorarioPresencial;
import utp.edu.pe.cruce_horarios.repository.HorarioPresencialRepository;
import utp.edu.pe.cruce_horarios.service.CruceHorarioService;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/horarios-presenciales")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8082"})
@Tag(name = "Base de Horarios Presenciales (Excel)", description = "Consulta de los 10,227 registros importados y validación de disponibilidad y aforo (INSCRITOS <= AFORO)")
public class HorarioPresencialController {

    @Autowired
    private HorarioPresencialRepository horarioPresencialRepository;

    @Autowired
    private CruceHorarioService cruceHorarioService;

    public record AulaAforoDto(String clase, Integer aforo) {}

    public record ValidacionAsignacionRequest(
            String clase,
            String diaClase,
            String horaInicio,
            String horaFin,
            Integer inscritos
    ) {}

    public record ConflictoAulaDto(
            String codCurso,
            String curso,
            String seccion,
            String diaClase,
            String horaInicio,
            String horaFin,
            Integer inscritos,
            Integer aforo
    ) {}

    public record ValidacionAsignacionResponse(
            boolean valido,
            boolean aulaDisponible,
            boolean capacidadSuficiente,
            String clase,
            Integer aforoAula,
            Integer inscritosSolicitados,
            String mensaje,
            List<ConflictoAulaDto> conflictos,
            List<AulaAforoDto> aulasSugeridas
    ) {}

    @Operation(summary = "GET /api/horarios-presenciales", description = "Lista paginada y filtrable de los registros de horarios presenciales (con CLASE limpia, AFORO e INSCRITOS)")
    @GetMapping
    public Map<String, Object> listar(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String dia,
            @RequestParam(required = false, defaultValue = "") String clase,
            @RequestParam(required = false, defaultValue = "false") boolean soloSobrecupo,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        Page<HorarioPresencial> result = horarioPresencialRepository.buscarFiltrado(
                q.trim(), dia.trim(), clase.trim(), soloSobrecupo, PageRequest.of(safePage, safeSize));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", result.getContent());
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("page", result.getNumber());
        response.put("size", result.getSize());
        response.put("totalRegistros", horarioPresencialRepository.count());
        response.put("totalSobrecupo", horarioPresencialRepository.countSobrecupo());
        response.put("totalAulas", horarioPresencialRepository.listarAulasConAforo().size());
        return response;
    }

    @Operation(summary = "GET /api/horarios-presenciales/resumen", description = "Conteo total, total de aulas limpias, clases con sobrecupo y muestra inicial")
    @GetMapping("/resumen")
    public Map<String, Object> resumen() {
        List<HorarioPresencial> muestra = horarioPresencialRepository.findTop10ByOrderByIdAsc();
        List<String> muestraClases = muestra.stream()
                .map(HorarioPresencial::getClase)
                .toList();
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("totalRegistros", horarioPresencialRepository.count());
        res.put("totalAulas", horarioPresencialRepository.listarAulasConAforo().size());
        res.put("totalSobrecupo", horarioPresencialRepository.countSobrecupo());
        res.put("muestraClases", muestraClases);
        return res;
    }

    @Operation(summary = "GET /api/horarios-presenciales/aulas", description = "Catálogo de salones limpios (CLASE) con su capacidad máxima (AFORO)")
    @GetMapping("/aulas")
    public List<AulaAforoDto> listarAulas() {
        return horarioPresencialRepository.listarAulasConAforo().stream()
                .map(row -> new AulaAforoDto(
                        row[0] == null ? "" : String.valueOf(row[0]),
                        row[1] == null ? null : ((Number) row[1]).intValue()))
                .toList();
    }

    @Operation(summary = "POST /api/horarios-presenciales/validar-asignacion", description = "Valida disponibilidad del salón en la franja horaria y verifica que INSCRITOS <= AFORO")
    @PostMapping("/validar-asignacion")
    public ResponseEntity<ValidacionAsignacionResponse> validarAsignacion(
            @RequestBody ValidacionAsignacionRequest req) {
        if (req == null || req.clase() == null || req.clase().isBlank()
                || req.diaClase() == null || req.diaClase().isBlank()
                || req.horaInicio() == null || req.horaInicio().isBlank()
                || req.horaFin() == null || req.horaFin().isBlank()) {
            return ResponseEntity.badRequest().body(new ValidacionAsignacionResponse(
                    false, false, false,
                    req == null ? "" : req.clase(),
                    null, req == null ? null : req.inscritos(),
                    "Complete aula (CLASE), día (DIA_CLASE), hora de inicio y hora de fin.",
                    List.of(), List.of()
            ));
        }

        String claseLimpia = req.clase().trim().toUpperCase();
        String diaNorm = normalizarDiaEspanol(req.diaClase());
        LocalTime hi = LocalTime.parse(req.horaInicio().trim().length() == 5 ? req.horaInicio().trim() + ":00" : req.horaInicio().trim());
        LocalTime hf = LocalTime.parse(req.horaFin().trim().length() == 5 ? req.horaFin().trim() + ":00" : req.horaFin().trim());
        int inscritos = req.inscritos() == null ? 0 : Math.max(0, req.inscritos());

        Integer aforoAula = horarioPresencialRepository.obtenerAforoMaximoDeAula(claseLimpia);
        boolean capacidadSuficiente = aforoAula == null || inscritos <= aforoAula;

        List<HorarioPresencial> delSalon = horarioPresencialRepository
                .findByClaseIgnoreCaseAndDiaClaseIgnoreCase(claseLimpia, diaNorm);

        List<ConflictoAulaDto> conflictos = new ArrayList<>();
        for (HorarioPresencial h : delSalon) {
            if (cruceHorarioService.seSolapan(h.getHoraInicio(), h.getHoraFin(), hi, hf)) {
                conflictos.add(new ConflictoAulaDto(
                        h.getCodCurso(),
                        h.getCurso(),
                        h.getSeccion(),
                        h.getDiaClase(),
                        h.getHoraInicio() != null ? h.getHoraInicio().toString().substring(0, 5) : "",
                        h.getHoraFin() != null ? h.getHoraFin().toString().substring(0, 5) : "",
                        h.getInscritos(),
                        h.getAforo()
                ));
            }
        }
        boolean aulaDisponible = conflictos.isEmpty();

        // Sugerir hasta 8 aulas libres con AFORO >= inscritos en esa misma franja
        List<HorarioPresencial> todosDia = horarioPresencialRepository.findByDiaClaseIgnoreCase(diaNorm);
        List<String> ocupadas = todosDia.stream()
                .filter(h -> h.getClase() != null && cruceHorarioService.seSolapan(h.getHoraInicio(), h.getHoraFin(), hi, hf))
                .map(h -> h.getClase().trim().toUpperCase())
                .distinct()
                .toList();

        List<AulaAforoDto> sugeridas = horarioPresencialRepository.listarAulasConAforo().stream()
                .map(row -> new AulaAforoDto(
                        String.valueOf(row[0]).trim().toUpperCase(),
                        row[1] == null ? 0 : ((Number) row[1]).intValue()))
                .filter(a -> !ocupadas.contains(a.clase()))
                .filter(a -> a.aforo() >= inscritos)
                .limit(8)
                .toList();

        boolean valido = aulaDisponible && capacidadSuficiente;
        String mensaje;
        if (!capacidadSuficiente && !aulaDisponible) {
            mensaje = "El salón " + claseLimpia + " está ocupado en esa franja y además no tiene capacidad suficiente (AFORO: "
                    + aforoAula + ", INSCRITOS: " + inscritos + ").";
        } else if (!capacidadSuficiente) {
            mensaje = "Capacidad insuficiente en el salón " + claseLimpia + ": el aforo máximo es "
                    + aforoAula + " alumnos, pero hay " + inscritos + " inscritos (INSCRITOS > AFORO).";
        } else if (!aulaDisponible) {
            ConflictoAulaDto primero = conflictos.get(0);
            mensaje = "El salón " + claseLimpia + " está ocupado el " + diaNorm + " (" + primero.horaInicio() + "–" + primero.horaFin()
                    + ") por " + primero.curso() + " (Sec. " + primero.seccion() + ").";
        } else if (aforoAula == null) {
            mensaje = "Salón " + claseLimpia + " disponible el " + diaNorm + " de " + hi.toString().substring(0, 5)
                    + " a " + hf.toString().substring(0, 5) + ".";
        } else {
            mensaje = "Asignación válida: salón " + claseLimpia + " disponible y con capacidad suficiente ("
                    + inscritos + " inscritos / " + aforoAula + " aforo).";
        }

        return ResponseEntity.ok(new ValidacionAsignacionResponse(
                valido, aulaDisponible, capacidadSuficiente, claseLimpia, aforoAula, inscritos, mensaje, conflictos, sugeridas
        ));
    }

    private String normalizarDiaEspanol(String dia) {
        String d = dia.trim().toUpperCase();
        return switch (d) {
            case "MONDAY", "LUNES" -> "Lunes";
            case "TUESDAY", "MARTES" -> "Martes";
            case "WEDNESDAY", "MIERCOLES", "MIÉRCOLES" -> "Miercoles";
            case "THURSDAY", "JUEVES" -> "Jueves";
            case "FRIDAY", "VIERNES" -> "Viernes";
            case "SATURDAY", "SABADO", "SÁBADO" -> "Sabado";
            case "SUNDAY", "DOMINGO" -> "Domingo";
            default -> dia.trim();
        };
    }
}
