package utp.edu.pe.cruce_horarios;

import utp.edu.pe.cruce_horarios.model.Horario;
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import utp.edu.pe.cruce_horarios.repository.ReprogramacionRepository;
import utp.edu.pe.cruce_horarios.service.CruceHorarioService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class CruceHorarioServiceTest {

    @Mock
    private HorarioRepository horarioRepository;

    @Mock
    private ReprogramacionRepository reprogramacionRepository;

    @Mock
    private MatriculaRepository matriculaRepository;

    @InjectMocks
    private CruceHorarioService cruceHorarioService;

    @Test
    void noDebeDetectarCruceSiNoHaySolapamiento() {
        // Escenario PU-02: Nueva franja no se solapa con el horario regular ni con reprogramaciones previas
        Horario existente = new Horario();
        existente.setDocenteCodigo("DOC-101");
        existente.setCurso("Desarrollo Web Integrado");
        existente.setDia(DayOfWeek.MONDAY);
        existente.setHoraInicio(LocalTime.of(8, 0));
        existente.setHoraFin(LocalTime.of(10, 0));

        when(horarioRepository.findByDocenteCodigo("DOC-101")).thenReturn(List.of(existente));
        when(reprogramacionRepository.findByDocenteCodigo("DOC-101")).thenReturn(Collections.emptyList());

        Reprogramacion nueva = new Reprogramacion();
        nueva.setDocenteCodigo("DOC-101");
        nueva.setCurso("Arquitectura de Software");
        nueva.setFecha(LocalDate.of(2026, 9, 7)); // Lunes
        nueva.setHoraInicio(LocalTime.of(10, 0));
        nueva.setHoraFin(LocalTime.of(12, 0));

        assertFalse(cruceHorarioService.existeCruce(nueva));
    }

    @Test
    void debeDetectarCruceDeHorario() {
        // Escenario PU-03: Nueva franja se solapa con una clase de su horario regular
        Horario existente = new Horario();
        existente.setDocenteCodigo("DOC-101");
        existente.setCurso("Desarrollo Web Integrado");
        existente.setDia(DayOfWeek.MONDAY);
        existente.setHoraInicio(LocalTime.of(8, 0));
        existente.setHoraFin(LocalTime.of(10, 0));

        when(horarioRepository.findByDocenteCodigo("DOC-101")).thenReturn(List.of(existente));

        Reprogramacion nueva = new Reprogramacion();
        nueva.setDocenteCodigo("DOC-101");
        nueva.setCurso("Base de Datos Avanzadas");
        nueva.setFecha(LocalDate.of(2026, 9, 7)); // Lunes
        nueva.setHoraInicio(LocalTime.of(9, 0));
        nueva.setHoraFin(LocalTime.of(11, 0));

        assertTrue(cruceHorarioService.existeCruce(nueva));
        assertEquals("Desarrollo Web Integrado", cruceHorarioService.obtenerCursoEnConflicto(nueva).orElse(""));
        assertEquals("No se puede reprogramar: existe un cruce de horario con Desarrollo Web Integrado",
                cruceHorarioService.obtenerMensajeConflicto(nueva).orElse(""));
    }

    @Test
    void noDebeDetectarCruceSiDocenteYEstudiantesEstanLibres() {
        // Escenario PU-04: Reprogramación libre para el docente y libre para los estudiantes matriculados
        Horario horarioDocente = new Horario("DOC-101", "Desarrollo Web Integrado",
                DayOfWeek.MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0));
        Horario horarioOtroCursoEst = new Horario("DOC-102", "Sistemas Operativos",
                DayOfWeek.MONDAY, LocalTime.of(14, 0), LocalTime.of(16, 0));

        when(horarioRepository.findByDocenteCodigo("DOC-101")).thenReturn(List.of(horarioDocente));
        when(reprogramacionRepository.findByDocenteCodigo("DOC-101")).thenReturn(Collections.emptyList());

        Matricula matCursoReprog = new Matricula("EST-201", "Desarrollo Web Integrado");
        Matricula matOtroCurso = new Matricula("EST-201", "Sistemas Operativos");
        when(matriculaRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(matCursoReprog));
        when(matriculaRepository.findByEstudianteCodigo("EST-201")).thenReturn(List.of(matCursoReprog, matOtroCurso));
        when(horarioRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(horarioDocente));
        when(horarioRepository.findByCurso("Sistemas Operativos")).thenReturn(List.of(horarioOtroCursoEst));
        when(reprogramacionRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(Collections.emptyList());
        when(reprogramacionRepository.findByCurso("Sistemas Operativos")).thenReturn(Collections.emptyList());

        Reprogramacion nueva = new Reprogramacion(
                "DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 10, 19), LocalTime.of(10, 0), LocalTime.of(12, 0));

        assertFalse(cruceHorarioService.existeCruce(nueva));
    }

    @Test
    void debeDetectarCruceConHorarioDeEstudianteMatriculado() {
        // Escenario PU-05: Libre para el docente pero se solapa con otra clase de un estudiante matriculado
        Horario horarioDocente = new Horario("DOC-101", "Desarrollo Web Integrado",
                DayOfWeek.MONDAY, LocalTime.of(8, 0), LocalTime.of(10, 0));
        Horario horarioOtroCursoEst = new Horario("DOC-102", "Sistemas Operativos",
                DayOfWeek.MONDAY, LocalTime.of(14, 0), LocalTime.of(16, 0));

        when(horarioRepository.findByDocenteCodigo("DOC-101")).thenReturn(List.of(horarioDocente));
        when(reprogramacionRepository.findByDocenteCodigo("DOC-101")).thenReturn(Collections.emptyList());

        Matricula matCursoReprog = new Matricula("EST-201", "Desarrollo Web Integrado");
        Matricula matOtroCurso = new Matricula("EST-201", "Sistemas Operativos");
        when(matriculaRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(matCursoReprog));
        when(matriculaRepository.findByEstudianteCodigo("EST-201")).thenReturn(List.of(matCursoReprog, matOtroCurso));
        when(horarioRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(horarioDocente));
        when(horarioRepository.findByCurso("Sistemas Operativos")).thenReturn(List.of(horarioOtroCursoEst));
        when(reprogramacionRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(Collections.emptyList());

        Reprogramacion nueva = new Reprogramacion(
                "DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 10, 19), LocalTime.of(14, 0), LocalTime.of(16, 0));

        assertTrue(cruceHorarioService.existeCruce(nueva));
        assertEquals("Sistemas Operativos", cruceHorarioService.obtenerCursoEnConflicto(nueva).orElse(""));
        assertEquals(
                "No se puede reprogramar: existe un cruce de horario del estudiante EST-201 con el curso Sistemas Operativos",
                cruceHorarioService.obtenerMensajeConflicto(nueva).orElse(""));
    }
}
