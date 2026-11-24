package utp.edu.pe.cruce_horarios.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping({
            "/login",
            "/registro",
            "/docente",
            "/estudiante",
            "/coordinador",
            "/consulta-horario",
            "/consulta-docente",
            "/consulta-estudiante",
            "/reprogramacion",
            "/registro-reprogramacion",
            "/base-horarios",
            "/confirmacion",
            "/gestion"
    })
    public String forwardSpa() {
        return "forward:/index.html";
    }
}
