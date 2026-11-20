package utp.edu.pe.cruce_horarios.controller;

import utp.edu.pe.cruce_horarios.model.Docente;
import utp.edu.pe.cruce_horarios.model.Horario;
import utp.edu.pe.cruce_horarios.repository.DocenteRepository;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/docentes")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8082"})
@Tag(name = "Módulo de Docentes", description = "Endpoints para la gestión y consulta del personal docente")
public class DocenteController {

    private static final String[][] NOMBRES_CATALOGO = {
            {"Roberto", "Salazar Mendoza"},
            {"Patricia", "Gutiérrez Quispe"},
            {"Fernando", "Vásquez Huamán"},
            {"Lucía", "Chávez Paredes"},
            {"Miguel", "Torres Delgado"}
    };

    private static final String[] CURSOS_CATALOGO = {
            "Desarrollo Web Integrado",
            "Arquitectura de Software",
            "Base de Datos II",
            "Ingeniería de Software",
            "Redes y Comunicaciones"
    };

    private static final String[] AULAS_CATALOGO = {"A102", "B205", "C304", "D201", "E104", "F202", "G301", "H105", "I204", "J302"};

    @Autowired
    private DocenteRepository docenteRepository;

    @Autowired
    private HorarioRepository horarioRepository;

    @Operation(summary = "GET /api/docentes", description = "Lista completa de docentes registrados")
    @GetMapping
    public List<Docente> listar() {
        return docenteRepository.findAll();
    }

    @Operation(summary = "GET /api/docentes/{codigo}", description = "Búsqueda de docente por su código único")
    @GetMapping("/{codigo}")
    public ResponseEntity<Docente> buscarPorCodigo(@PathVariable String codigo) {
        return docenteRepository.findByCodigo(codigo.trim().toUpperCase())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "POST /api/docentes", description = "Registra un docente o coordinador solo por código, autocompletando sus datos y horarios iniciales")
    @PostMapping
    public Docente crear(@RequestBody Docente docente) {
        String codigo = docente.getCodigo() == null ? "" : docente.getCodigo().trim().toUpperCase();
        Optional<Docente> existente = docenteRepository.findByCodigo(codigo);
        if (existente.isPresent()) {
            return existente.get();
        }

        docente.setCodigo(codigo);
        if (docente.getNombres() == null || docente.getNombres().isBlank()
                || docente.getApellidos() == null || docente.getApellidos().isBlank()) {
            if (codigo.startsWith("COORD")) {
                docente.setNombres("Alejandro");
                docente.setApellidos("Morales Vega (Coordinador)");
            } else {
                int idx = Math.abs(codigo.hashCode()) % NOMBRES_CATALOGO.length;
                if (docente.getNombres() == null || docente.getNombres().isBlank()) {
                    docente.setNombres(NOMBRES_CATALOGO[idx][0]);
                }
                if (docente.getApellidos() == null || docente.getApellidos().isBlank()) {
                    docente.setApellidos(NOMBRES_CATALOGO[idx][1]);
                }
            }
        }

        Docente guardado = docenteRepository.save(docente);

        if (!codigo.startsWith("COORD") && horarioRepository.findByDocenteCodigo(codigo).isEmpty()) {
            int base = Math.abs(codigo.hashCode());
            DayOfWeek[] dias = {DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY, DayOfWeek.TUESDAY, DayOfWeek.THURSDAY};
            String curso1 = CURSOS_CATALOGO[base % CURSOS_CATALOGO.length];
            String curso2 = CURSOS_CATALOGO[(base + 2) % CURSOS_CATALOGO.length];
            String aula1 = AULAS_CATALOGO[base % AULAS_CATALOGO.length];
            String aula2 = AULAS_CATALOGO[(base + 3) % AULAS_CATALOGO.length];

            horarioRepository.save(new Horario(codigo, curso1, dias[base % dias.length], LocalTime.of(8, 45), LocalTime.of(10, 15), aula1));
            horarioRepository.save(new Horario(codigo, curso2, dias[(base + 1) % dias.length], LocalTime.of(15, 45), LocalTime.of(17, 15), aula2));
        }

        return guardado;
    }
}
