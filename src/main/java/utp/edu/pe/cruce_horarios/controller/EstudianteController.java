package utp.edu.pe.cruce_horarios.controller;

import utp.edu.pe.cruce_horarios.model.Estudiante;
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.repository.EstudianteRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/estudiantes")
@CrossOrigin(origins = { "http://localhost:4200", "http://localhost:8082" })
@Tag(name = "Módulo de Estudiantes", description = "Endpoints para la gestión y consulta de estudiantes")
public class EstudianteController {

    private static final String[][] ESTUDIANTES_CATALOGO = {
            { "Camila", "Flores Quispe" },
            { "Diego", "Valdivia Ramos" },
            { "Valeria", "Castro Medina" },
            { "Sebastián", "Paredes Huanca" },
            { "Sofía", "Ccahuana López" }
    };

    private static final String[] CURSOS_MATRICULA = {
            "Desarrollo Web Integrado",
            "Arquitectura de Software",
            "Base de Datos II",
            "Sistemas Operativos",
            "Inteligencia Artificial"
    };

    @Autowired
    private EstudianteRepository estudianteRepository;

    @Autowired
    private MatriculaRepository matriculaRepository;

    @Operation(summary = "GET /api/estudiantes", description = "Lista completa de estudiantes registrados")
    @GetMapping
    public List<Estudiante> listar() {
        return estudianteRepository.findAll();
    }

    @Operation(summary = "GET /api/estudiantes/{codigo}", description = "Búsqueda de estudiante por su código único")
    @GetMapping("/{codigo}")
    public ResponseEntity<Estudiante> buscarPorCodigo(@PathVariable String codigo) {
        return estudianteRepository.findByCodigo(codigo.trim().toUpperCase())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "POST /api/estudiantes", description = "Registra un estudiante solo por código, autocompletando sus datos y matrículas iniciales")
    @PostMapping
    public Estudiante crear(@RequestBody Estudiante estudiante) {
        String codigo = estudiante.getCodigo() == null ? "" : estudiante.getCodigo().trim().toUpperCase();
        Optional<Estudiante> existente = estudianteRepository.findByCodigo(codigo);
        if (existente.isPresent()) {
            return existente.get();
        }

        estudiante.setCodigo(codigo);
        int idx = Math.abs(codigo.hashCode()) % ESTUDIANTES_CATALOGO.length;
        if (estudiante.getNombres() == null || estudiante.getNombres().isBlank()) {
            estudiante.setNombres(ESTUDIANTES_CATALOGO[idx][0]);
        }
        if (estudiante.getApellidos() == null || estudiante.getApellidos().isBlank()) {
            estudiante.setApellidos(ESTUDIANTES_CATALOGO[idx][1]);
        }

        Estudiante guardado = estudianteRepository.save(estudiante);

        if (matriculaRepository.findByEstudianteCodigo(codigo).isEmpty()) {
            String curso1 = CURSOS_MATRICULA[idx % CURSOS_MATRICULA.length];
            String curso2 = CURSOS_MATRICULA[(idx + 1) % CURSOS_MATRICULA.length];
            matriculaRepository.save(new Matricula(codigo, curso1));
            matriculaRepository.save(new Matricula(codigo, curso2));
        }

        return guardado;
    }
}
