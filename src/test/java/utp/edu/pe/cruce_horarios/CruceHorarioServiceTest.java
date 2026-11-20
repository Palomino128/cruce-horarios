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
import static org.mockito.ArgumentMatchers.anyString;
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

    @Test
    void debeValidarReglasAcademicasDe45MinutosRangoHorarioTrasladoYAula() {
        Horario existente = new Horario("DOC-101", "Desarrollo Web Integrado",
                DayOfWeek.MONDAY, LocalTime.of(7, 0), LocalTime.of(8, 30), "A101");

        // Fuera del horario universitario de lunes a sábado (07:00 - 22:30)
        Reprogramacion fueraRango = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 23), LocalTime.of(6, 15), LocalTime.of(7, 45), "B204");
        assertTrue(cruceHorarioService.validarReglasAcademicas(fueraRango)
                .orElse("").contains("07:00 am a 10:30 pm"));

        // Domingos restringidos de 07:00 am a 02:00 pm (14:00)
        Reprogramacion domingoTarde = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 22), LocalTime.of(14, 0), LocalTime.of(15, 30), "B204");
        assertTrue(cruceHorarioService.validarReglasAcademicas(domingoTarde)
                .orElse("").contains("14:00"));

        Reprogramacion domingoMananaValida = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 22), LocalTime.of(12, 15), LocalTime.of(13, 45), "B204");
        assertTrue(cruceHorarioService.validarReglasAcademicas(domingoMananaValida).isEmpty());

        // Duración no múltiplo de 45 min (ej. 60 min)
        Reprogramacion duracionInvalida = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 23), LocalTime.of(10, 0), LocalTime.of(11, 0), "B204");
        assertTrue(cruceHorarioService.validarReglasAcademicas(duracionInvalida)
                .orElse("").contains("45 minutos"));

        // Intervalo < 15 min de traslado docente
        when(horarioRepository.findByDocenteCodigo("DOC-101")).thenReturn(List.of(existente));
        Reprogramacion sinTraslado = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 23), LocalTime.of(8, 40), LocalTime.of(10, 10), "B204");
        assertTrue(cruceHorarioService.validarReglasAcademicas(sinTraslado)
                .orElse("").contains("Intervalo de traslado docente insuficiente"));

        // Salón ocupado en la franja
        Horario aulaOcupada = new Horario("DOC-102", "Base de Datos II",
                DayOfWeek.MONDAY, LocalTime.of(8, 45), LocalTime.of(10, 15), "E201");
        when(reprogramacionRepository.findByDocenteCodigo("DOC-101")).thenReturn(Collections.emptyList());
        when(horarioRepository.findAll()).thenReturn(List.of(existente, aulaOcupada));
        Reprogramacion salonOcupado = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 23), LocalTime.of(8, 45), LocalTime.of(10, 15), "E201");
        assertTrue(cruceHorarioService.validarReglasAcademicas(salonOcupado)
                .orElse("").contains("salón E201"));

        // Bloque válido de 90 min (2 x 45 min) con >= 15 min de traslado y aula libre
        Reprogramacion valida = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                LocalDate.of(2026, 11, 23), LocalTime.of(8, 45), LocalTime.of(10, 15), "C302");
        assertTrue(cruceHorarioService.validarReglasAcademicas(valida).isEmpty());
    }

    @Test
    void debeCalcularDisponibilidadPresencialParcial() {
        Horario hCurso = new Horario("DOC-101", "Desarrollo Web Integrado",
                DayOfWeek.MONDAY, LocalTime.of(7, 0), LocalTime.of(8, 30), "A101");
        Horario hOtro = new Horario("DOC-102", "Sistemas Operativos",
                DayOfWeek.TUESDAY, LocalTime.of(14, 0), LocalTime.of(15, 30), "F305");

        when(matriculaRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(
                new Matricula("EST-01", "Desarrollo Web Integrado"),
                new Matricula("EST-02", "Desarrollo Web Integrado"),
                new Matricula("EST-03", "Desarrollo Web Integrado")
        ));
        when(matriculaRepository.findByEstudianteCodigo("EST-01")).thenReturn(List.of(
                new Matricula("EST-01", "Desarrollo Web Integrado"),
                new Matricula("EST-01", "Sistemas Operativos")
        ));
        when(matriculaRepository.findByEstudianteCodigo("EST-02")).thenReturn(List.of(
                new Matricula("EST-02", "Desarrollo Web Integrado")
        ));
        when(matriculaRepository.findByEstudianteCodigo("EST-03")).thenReturn(List.of(
                new Matricula("EST-03", "Desarrollo Web Integrado")
        ));
        when(horarioRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(hCurso));
        when(horarioRepository.findByCurso("Sistemas Operativos")).thenReturn(List.of(hOtro));
        when(reprogramacionRepository.findByCurso(anyString())).thenReturn(Collections.emptyList());

        // Buscar próximo martes
        LocalDate proximoMartes = LocalDate.now().plusDays(1);
        while (proximoMartes.getDayOfWeek() != DayOfWeek.TUESDAY) {
            proximoMartes = proximoMartes.plusDays(1);
        }

        Reprogramacion candidata = new Reprogramacion("DOC-101", "Desarrollo Web Integrado",
                proximoMartes, LocalTime.of(14, 0), LocalTime.of(15, 30));

        CruceHorarioService.DisponibilidadPresencial disp =
                cruceHorarioService.calcularDisponibilidadPresencial(candidata);

        assertEquals(3, disp.totalEstudiantes());
        assertEquals(2, disp.disponibles());
        assertEquals(1, disp.conCruce());
        assertEquals(66.7, disp.porcentajeAsistencia());
        assertEquals(List.of("EST-01"), disp.estudiantesConCruce());
    }

    @Test
    void debeRecomendarMayorAl50ManteniendoOpcionesBajasVisibles() {
        Horario hCurso = new Horario("DOC-101", "Desarrollo Web Integrado",
                DayOfWeek.MONDAY, LocalTime.of(7, 0), LocalTime.of(8, 30), "A101");
        LocalDate manana = LocalDate.now().plusDays(1);
        DayOfWeek diaManana = manana.getDayOfWeek();

        // Dos estudiantes de 3 tienen otro curso mañana 14:00-15:30 => 33.3% (<= 50%, recomendada=false)
        Horario hOtro = new Horario("DOC-102", "Redes", diaManana, LocalTime.of(14, 0), LocalTime.of(15, 30), "B108");

        when(horarioRepository.findByDocenteCodigo("DOC-101")).thenReturn(List.of(hCurso));
        when(reprogramacionRepository.findByDocenteCodigo("DOC-101")).thenReturn(Collections.emptyList());
        when(horarioRepository.findAll()).thenReturn(List.of(hCurso, hOtro));
        when(reprogramacionRepository.findAll()).thenReturn(Collections.emptyList());

        when(matriculaRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(
                new Matricula("EST-01", "Desarrollo Web Integrado"),
                new Matricula("EST-02", "Desarrollo Web Integrado"),
                new Matricula("EST-03", "Desarrollo Web Integrado")
        ));
        when(matriculaRepository.findByEstudianteCodigo("EST-01")).thenReturn(List.of(
                new Matricula("EST-01", "Desarrollo Web Integrado"),
                new Matricula("EST-01", "Redes")
        ));
        when(matriculaRepository.findByEstudianteCodigo("EST-02")).thenReturn(List.of(
                new Matricula("EST-02", "Desarrollo Web Integrado"),
                new Matricula("EST-02", "Redes")
        ));
        when(matriculaRepository.findByEstudianteCodigo("EST-03")).thenReturn(List.of(
                new Matricula("EST-03", "Desarrollo Web Integrado")
        ));
        when(horarioRepository.findByCurso("Desarrollo Web Integrado")).thenReturn(List.of(hCurso));
        when(horarioRepository.findByCurso("Redes")).thenReturn(List.of(hOtro));
        when(reprogramacionRepository.findByCurso(anyString())).thenReturn(Collections.emptyList());

        List<CruceHorarioService.OpcionRecuperacion> opciones =
                cruceHorarioService.recomendarOpcionesRecuperacion("DOC-101", "Desarrollo Web Integrado");

        assertFalse(opciones.isEmpty());
        assertTrue(opciones.stream().anyMatch(o -> o.recomendada() && o.porcentajeAsistencia() > 50.0));
        assertTrue(opciones.stream().anyMatch(o -> !o.recomendada() && o.porcentajeAsistencia() <= 50.0));
        // Ningún domingo puede pasar de las 14:00
        assertTrue(opciones.stream()
                .filter(o -> "SUNDAY".equals(o.dia()))
                .allMatch(o -> !LocalTime.parse(o.horaFin()).isAfter(LocalTime.of(14, 0))));
        // Ordenadas descendentemente por porcentaje de asistencia
        for (int i = 1; i < opciones.size(); i++) {
            assertTrue(opciones.get(i - 1).porcentajeAsistencia() >= opciones.get(i).porcentajeAsistencia());
        }
    }
}
