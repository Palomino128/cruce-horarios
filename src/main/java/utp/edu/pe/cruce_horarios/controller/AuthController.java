package utp.edu.pe.cruce_horarios.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import utp.edu.pe.cruce_horarios.model.Docente;
import utp.edu.pe.cruce_horarios.model.Estudiante;
import utp.edu.pe.cruce_horarios.repository.DocenteRepository;
import utp.edu.pe.cruce_horarios.repository.EstudianteRepository;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:8082"})
@Tag(name = "Autenticación Institucional", description = "Validación de acceso por rol institucional (Estudiante, Docente, Coordinador Académico)")
public class AuthController {

    private final DocenteRepository docenteRepository;
    private final EstudianteRepository estudianteRepository;
    private final String institutionalPassword;

    public AuthController(
            DocenteRepository docenteRepository,
            EstudianteRepository estudianteRepository,
            @Value("${app.auth.password:utp2026}") String institutionalPassword) {
        this.docenteRepository = docenteRepository;
        this.estudianteRepository = estudianteRepository;
        this.institutionalPassword = institutionalPassword;
    }

    public record LoginRequest(String rol, String codigo, String password) {}

    public record LoginResponse(String rol, String codigo, String nombres, String apellidos) {}

    @Operation(summary = "POST /api/auth/login", description = "Valida credenciales institucionales por perfil y retorna los datos del usuario autenticado")
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        String rol = req == null || req.rol() == null ? "" : req.rol().trim();
        String codigo = req == null || req.codigo() == null ? "" : req.codigo().trim().toUpperCase();
        String password = req == null || req.password() == null ? "" : req.password();

        if (rol.isBlank() || codigo.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "Ingrese perfil, código institucional y contraseña."));
        }

        if (!institutionalPassword.equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "Contraseña institucional incorrecta."));
        }

        if ("Estudiante".equalsIgnoreCase(rol)) {
            Optional<Estudiante> est = estudianteRepository.findByCodigo(codigo);
            if (est.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "La cuenta de estudiante " + codigo + " no existe en el padrón registrado."));
            }
            Estudiante e = est.get();
            return ResponseEntity.ok(new LoginResponse("Estudiante", e.getCodigo(), e.getNombres(), e.getApellidos()));
        }

        if ("Docente".equalsIgnoreCase(rol) && codigo.startsWith("COORD")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "El código " + codigo + " pertenece al perfil Coordinador. Cambie de perfil para ingresar."));
        }

        if ("Coordinador Académico".equalsIgnoreCase(rol) && !codigo.startsWith("COORD")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "Para Coordinador Académico utilice una cuenta oficial (COORD-01, COORD-02 o COORD-03)."));
        }

        Optional<Docente> persona = docenteRepository.findByCodigo(codigo);
        if (persona.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("mensaje", "La cuenta " + codigo + " no se encuentra registrada en el sistema."));
        }

        Docente d = persona.get();
        String rolFinal = codigo.startsWith("COORD") ? "Coordinador Académico" : "Docente";
        return ResponseEntity.ok(new LoginResponse(rolFinal, d.getCodigo(), d.getNombres(), d.getApellidos()));
    }
}
