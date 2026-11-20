package utp.edu.pe.cruce_horarios.service;

import utp.edu.pe.cruce_horarios.model.Horario;
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import utp.edu.pe.cruce_horarios.repository.ReprogramacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class CruceHorarioService {

    private static final LocalTime HORA_INICIO_UNIV = LocalTime.of(7, 0);
    private static final LocalTime HORA_FIN_UNIV = LocalTime.of(22, 30);
    private static final LocalTime HORA_FIN_DOMINGO = LocalTime.of(14, 0);
    private static final int HORA_ACADEMICA_MIN = 45;
    private static final int INTERVALO_TRASLADO_MIN = 15;

    @Autowired
    private HorarioRepository horarioRepository;

    @Autowired
    private ReprogramacionRepository reprogramacionRepository;

    @Autowired
    private MatriculaRepository matriculaRepository;

    public CruceHorarioService() {}

    public CruceHorarioService(HorarioRepository horarioRepository, ReprogramacionRepository reprogramacionRepository) {
        this.horarioRepository = horarioRepository;
        this.reprogramacionRepository = reprogramacionRepository;
    }

    public CruceHorarioService(HorarioRepository horarioRepository,
                               ReprogramacionRepository reprogramacionRepository,
                               MatriculaRepository matriculaRepository) {
        this.horarioRepository = horarioRepository;
        this.reprogramacionRepository = reprogramacionRepository;
        this.matriculaRepository = matriculaRepository;
    }

    private record Conflicto(String curso, String estudianteCodigo, String aulaOcupada) {}

    public record DisponibilidadPresencial(
            int totalEstudiantes,
            int disponibles,
            int conCruce,
            double porcentajeAsistencia,
            List<String> estudiantesConCruce
    ) {}

    public record OpcionRecuperacion(
            String fecha,
            String dia,
            String horaInicio,
            String horaFin,
            String aulaSugerida,
            double porcentajeAsistencia,
            boolean recomendada
    ) {}

    /**
     * Valida todas las reglas académicas universitarias para registrar una reprogramación:
     * 1) Rango universitario 07:00 am a 10:30 pm y hora fin > hora inicio.
     * 2) Duración múltiplo de la hora académica de 45 minutos.
     * 3) Docente sin cruce directo y con intervalo mínimo de 15 minutos de traslado.
     * 4) Salón libre (si fue especificado).
     * Los alumnos ya matriculados definen el porcentaje de asistencia (>50% recomendado).
     */
    public Optional<String> validarReglasAcademicas(Reprogramacion nueva) {
        if (nueva == null || nueva.getDocenteCodigo() == null || nueva.getDocenteCodigo().isBlank()
                || nueva.getCurso() == null || nueva.getCurso().isBlank()
                || nueva.getFecha() == null || nueva.getHoraInicio() == null || nueva.getHoraFin() == null) {
            return Optional.of("Complete docente, curso, fecha, hora de inicio y hora de fin.");
        }

        Optional<String> rangoError = validarFranjaHoraria(
                nueva.getFecha().getDayOfWeek(), nueva.getHoraInicio(), nueva.getHoraFin());
        if (rangoError.isPresent()) {
            return rangoError;
        }

        String doc = nueva.getDocenteCodigo().trim().toUpperCase();
        nueva.setDocenteCodigo(doc);

        if (horarioRepository != null) {
            List<Horario> horariosDoc = horarioRepository.findByDocenteCodigo(doc);
            Optional<String> cruceHorario = buscarCruceEnHorarios(horariosDoc, nueva);
            if (cruceHorario.isPresent()) {
                return Optional.of("No se puede reprogramar: el docente tiene cruce de horario con " + cruceHorario.get());
            }
            Optional<String> trasladoHorario = buscarViolacionTrasladoEnHorarios(horariosDoc, nueva);
            if (trasladoHorario.isPresent()) {
                return trasladoHorario;
            }
        }

        if (reprogramacionRepository != null) {
            List<Reprogramacion> reprogsDoc = reprogramacionRepository.findByDocenteCodigo(doc);
            Optional<String> cruceReprog = buscarCruceEnReprogramaciones(reprogsDoc, nueva);
            if (cruceReprog.isPresent()) {
                return Optional.of("No se puede reprogramar: el docente ya tiene otra recuperación en " + cruceReprog.get());
            }
            Optional<String> trasladoReprog = buscarViolacionTrasladoEnReprogramaciones(reprogsDoc, nueva);
            if (trasladoReprog.isPresent()) {
                return trasladoReprog;
            }
        }

        if (nueva.getAula() != null && !nueva.getAula().isBlank()) {
            String aulaSolicitada = nueva.getAula().trim().toUpperCase();
            if (horarioRepository != null) {
                List<Horario> mismosSalones = horarioRepository.findAll().stream()
                        .filter(h -> h.getAula() != null && aulaSolicitada.equalsIgnoreCase(h.getAula().trim()))
                        .toList();
                Optional<String> cruceSalonHorario = buscarCruceEnHorarios(mismosSalones, nueva);
                if (cruceSalonHorario.isPresent()) {
                    return Optional.of("No se puede reprogramar: el salón " + aulaSolicitada
                            + " está ocupado por el curso " + cruceSalonHorario.get());
                }
            }
            if (reprogramacionRepository != null) {
                List<Reprogramacion> mismasReprogs = reprogramacionRepository.findAll().stream()
                        .filter(r -> !"RECHAZADO".equalsIgnoreCase(r.getEstado()))
                        .filter(r -> r.getAula() != null && aulaSolicitada.equalsIgnoreCase(r.getAula().trim()))
                        .toList();
                Optional<String> cruceSalonReprog = buscarCruceEnReprogramaciones(mismasReprogs, nueva);
                if (cruceSalonReprog.isPresent()) {
                    return Optional.of("No se puede reprogramar: el salón " + aulaSolicitada
                            + " está ocupado por la recuperación de " + cruceSalonReprog.get());
                }
            }
        }

        return Optional.empty();
    }

    public Optional<String> validarHorarioRegular(Horario h) {
        if (h == null || h.getDocenteCodigo() == null || h.getDocenteCodigo().isBlank()
                || h.getCurso() == null || h.getCurso().isBlank()
                || h.getDia() == null || h.getHoraInicio() == null || h.getHoraFin() == null) {
            return Optional.of("Todos los campos del horario regular son obligatorios.");
        }

        Optional<String> rangoError = validarFranjaHoraria(h.getDia(), h.getHoraInicio(), h.getHoraFin());
        if (rangoError.isPresent()) {
            return rangoError;
        }

        String doc = h.getDocenteCodigo().trim().toUpperCase();
        h.setDocenteCodigo(doc);

        if (horarioRepository != null) {
            List<Horario> horariosDoc = horarioRepository.findByDocenteCodigo(doc);
            for (Horario ex : horariosDoc) {
                if (ex.getDia() == h.getDia()) {
                    if (seSolapan(ex.getHoraInicio(), ex.getHoraFin(), h.getHoraInicio(), h.getHoraFin())) {
                        return Optional.of("El docente " + doc + " ya tiene clase (" + ex.getCurso() + ") en esa franja.");
                    }
                    long gap = calcularIntervaloMinutos(ex.getHoraInicio(), ex.getHoraFin(), h.getHoraInicio(), h.getHoraFin());
                    if (gap < INTERVALO_TRASLADO_MIN) {
                        return Optional.of("Intervalo de traslado insuficiente (" + gap
                                + " min): se requieren al menos 15 minutos con " + ex.getCurso() + ".");
                    }
                }
            }
            if (h.getAula() != null && !h.getAula().isBlank()) {
                String aula = h.getAula().trim().toUpperCase();
                for (Horario ex : horarioRepository.findAll()) {
                    if (ex.getDia() == h.getDia() && ex.getAula() != null && aula.equalsIgnoreCase(ex.getAula().trim())
                            && seSolapan(ex.getHoraInicio(), ex.getHoraFin(), h.getHoraInicio(), h.getHoraFin())) {
                        return Optional.of("El salón " + aula + " ya está ocupado por " + ex.getCurso() + ".");
                    }
                }
            }
        }
        return Optional.empty();
    }

    private Optional<String> validarFranjaHoraria(DayOfWeek dia, LocalTime hi, LocalTime hf) {
        if (!hf.isAfter(hi)) {
            return Optional.of("La hora de fin debe ser posterior a la hora de inicio.");
        }
        if (dia == DayOfWeek.SUNDAY) {
            if (hi.isBefore(HORA_INICIO_UNIV) || hf.isAfter(HORA_FIN_DOMINGO)) {
                return Optional.of("Los domingos el horario universitario permitido es de 07:00 am a 02:00 pm (14:00).");
            }
        } else if (hi.isBefore(HORA_INICIO_UNIV) || hf.isAfter(HORA_FIN_UNIV)) {
            return Optional.of("El horario universitario permitido de lunes a sábado es de 07:00 am a 10:30 pm (22:30).");
        }
        long minutos = Duration.between(hi, hf).toMinutes();
        if (minutos < HORA_ACADEMICA_MIN || minutos % HORA_ACADEMICA_MIN != 0) {
            return Optional.of("La duración de clase debe ser múltiplo de la hora académica de 45 minutos (45, 90, 135 min...). Actual: "
                    + minutos + " min.");
        }
        return Optional.empty();
    }

    public boolean existeCruce(Reprogramacion nueva) {
        return detectarConflicto(nueva).isPresent();
    }

    public Optional<String> obtenerCursoEnConflicto(Reprogramacion nueva) {
        return detectarConflicto(nueva).map(Conflicto::curso);
    }

    public Optional<String> obtenerMensajeConflicto(Reprogramacion nueva) {
        return detectarConflicto(nueva).map(c -> {
            if (c.aulaOcupada() != null) {
                return "No se puede reprogramar: el salón " + c.aulaOcupada()
                        + " está ocupado por el curso " + c.curso();
            }
            if (c.estudianteCodigo() == null) {
                return "No se puede reprogramar: existe un cruce de horario con " + c.curso();
            }
            return "No se puede reprogramar: existe un cruce de horario del estudiante "
                    + c.estudianteCodigo() + " con el curso " + c.curso();
        });
    }

    public List<Reprogramacion> obtenerReprogramacionesEstudiante(String estudianteCodigo) {
        List<Reprogramacion> resultado = new ArrayList<>();
        if (matriculaRepository == null || reprogramacionRepository == null || estudianteCodigo == null) {
            return resultado;
        }
        List<Matricula> matriculas = matriculaRepository.findByEstudianteCodigo(estudianteCodigo.trim().toUpperCase());
        if (matriculas == null || matriculas.isEmpty()) {
            matriculas = matriculaRepository.findByEstudianteCodigo(estudianteCodigo);
        }
        if (matriculas == null) {
            return resultado;
        }
        Set<Long> idsVistos = new HashSet<>();
        for (Matricula m : matriculas) {
            if (m.getCurso() == null) {
                continue;
            }
            List<Reprogramacion> reprogsCurso = reprogramacionRepository.findByCurso(m.getCurso());
            if (reprogsCurso != null) {
                for (Reprogramacion r : reprogsCurso) {
                    if ("RECHAZADO".equalsIgnoreCase(r.getEstado())) {
                        continue;
                    }
                    if (r.getId() == null || idsVistos.add(r.getId())) {
                        resultado.add(r);
                    }
                }
            }
        }
        return resultado;
    }

    public List<Horario> obtenerHorariosEstudiante(String estudianteCodigo) {
        List<Horario> resultado = new ArrayList<>();
        if (matriculaRepository == null || horarioRepository == null || estudianteCodigo == null) {
            return resultado;
        }
        List<Matricula> matriculas = matriculaRepository.findByEstudianteCodigo(estudianteCodigo);
        if (matriculas == null) {
            return resultado;
        }
        for (Matricula m : matriculas) {
            if (m.getCurso() == null) {
                continue;
            }
            List<Horario> horariosCurso = horarioRepository.findByCurso(m.getCurso());
            if (horariosCurso != null) {
                resultado.addAll(horariosCurso);
            }
        }
        return resultado;
    }

    public DisponibilidadPresencial calcularDisponibilidadPresencial(Reprogramacion nueva) {
        if (matriculaRepository == null || nueva == null || nueva.getCurso() == null
                || nueva.getFecha() == null || nueva.getHoraInicio() == null || nueva.getHoraFin() == null) {
            return new DisponibilidadPresencial(0, 0, 0, 100.0, List.of());
        }

        List<Matricula> inscritos = matriculaRepository.findByCurso(nueva.getCurso());
        if (inscritos == null || inscritos.isEmpty()) {
            return new DisponibilidadPresencial(0, 0, 0, 100.0, List.of());
        }

        Set<String> codigosUnicos = new LinkedHashSet<>();
        for (Matricula m : inscritos) {
            if (m.getEstudianteCodigo() != null && !m.getEstudianteCodigo().isBlank()) {
                codigosUnicos.add(m.getEstudianteCodigo());
            }
        }

        List<String> afectados = new ArrayList<>();
        for (String estCodigo : codigosUnicos) {
            if (estudianteTieneCruce(estCodigo, nueva)) {
                afectados.add(estCodigo);
            }
        }

        int total = codigosUnicos.size();
        int conCruce = afectados.size();
        int disponibles = Math.max(0, total - conCruce);
        double porcentaje = total == 0 ? 100.0 : Math.round((disponibles * 1000.0) / total) / 10.0;

        return new DisponibilidadPresencial(total, disponibles, conCruce, porcentaje, afectados);
    }

    public List<OpcionRecuperacion> recomendarOpcionesRecuperacion(String docenteCodigo, String curso) {
        if (docenteCodigo == null || docenteCodigo.isBlank() || curso == null || curso.isBlank()) {
            return List.of();
        }
        String doc = docenteCodigo.trim().toUpperCase();
        String cur = curso.trim();

        List<Horario> horariosDocente = horarioRepository != null ? horarioRepository.findByDocenteCodigo(doc) : List.of();
        List<Reprogramacion> reprogsDocente = reprogramacionRepository != null ? reprogramacionRepository.findByDocenteCodigo(doc) : List.of();
        List<Horario> todosHorarios = horarioRepository != null ? horarioRepository.findAll() : List.of();
        List<Reprogramacion> todasReprogs = reprogramacionRepository != null ? reprogramacionRepository.findAll() : List.of();

        List<String> salonesBase = List.of("A101", "A205", "B108", "B204", "C302", "D105", "E201", "F305", "G102", "H203", "I301", "J402");
        LocalTime[][] franjas = new LocalTime[][]{
                {LocalTime.of(7, 0), LocalTime.of(8, 30)},
                {LocalTime.of(8, 45), LocalTime.of(10, 15)},
                {LocalTime.of(10, 30), LocalTime.of(12, 0)},
                {LocalTime.of(12, 15), LocalTime.of(13, 45)},
                {LocalTime.of(14, 0), LocalTime.of(15, 30)},
                {LocalTime.of(15, 45), LocalTime.of(17, 15)},
                {LocalTime.of(17, 30), LocalTime.of(19, 0)},
                {LocalTime.of(19, 15), LocalTime.of(20, 45)},
                {LocalTime.of(21, 0), LocalTime.of(22, 30)}
        };

        List<OpcionRecuperacion> opciones = new ArrayList<>();
        LocalDate hoy = LocalDate.now();

        for (int offset = 1; offset <= 7; offset++) {
            LocalDate fecha = hoy.plusDays(offset);
            DayOfWeek dia = fecha.getDayOfWeek();

            for (LocalTime[] franja : franjas) {
                LocalTime hi = franja[0];
                LocalTime hf = franja[1];
                if (dia == DayOfWeek.SUNDAY && hf.isAfter(HORA_FIN_DOMINGO)) {
                    continue;
                }

                Reprogramacion candidata = new Reprogramacion();
                candidata.setDocenteCodigo(doc);
                candidata.setCurso(cur);
                candidata.setFecha(fecha);
                candidata.setHoraInicio(hi);
                candidata.setHoraFin(hf);

                // Omitir si el docente tiene cruce directo o viola los 15 minutos de traslado
                if (buscarCruceEnHorarios(horariosDocente, candidata).isPresent()
                        || buscarCruceEnReprogramaciones(reprogsDocente, candidata).isPresent()
                        || buscarViolacionTrasladoEnHorarios(horariosDocente, candidata).isPresent()
                        || buscarViolacionTrasladoEnReprogramaciones(reprogsDocente, candidata).isPresent()) {
                    continue;
                }

                String aulaLibre = salonesBase.stream()
                        .filter(aula -> salonLibre(aula, dia, fecha, hi, hf, todosHorarios, todasReprogs))
                        .findFirst()
                        .orElse("A101");

                DisponibilidadPresencial disp = calcularDisponibilidadPresencial(candidata);
                double porcentaje = disp.porcentajeAsistencia();
                boolean recomendada = porcentaje > 50.0;

                opciones.add(new OpcionRecuperacion(
                        fecha.toString(),
                        dia.name(),
                        hi.toString(),
                        hf.toString(),
                        aulaLibre,
                        porcentaje,
                        recomendada
                ));
            }
        }

        opciones.sort(Comparator
                .comparingDouble(OpcionRecuperacion::porcentajeAsistencia).reversed()
                .thenComparing(OpcionRecuperacion::fecha)
                .thenComparing(OpcionRecuperacion::horaInicio));
        return opciones;
    }

    private boolean salonLibre(String aula, DayOfWeek dia, LocalDate fecha, LocalTime hi, LocalTime hf,
                               List<Horario> todosHorarios, List<Reprogramacion> todasReprogs) {
        for (Horario h : todosHorarios) {
            if (h.getDia() == dia && h.getAula() != null && aula.equalsIgnoreCase(h.getAula().trim())
                    && seSolapan(h.getHoraInicio(), h.getHoraFin(), hi, hf)) {
                return false;
            }
        }
        for (Reprogramacion r : todasReprogs) {
            if (!"RECHAZADO".equalsIgnoreCase(r.getEstado())
                    && fecha.equals(r.getFecha()) && r.getAula() != null && aula.equalsIgnoreCase(r.getAula().trim())
                    && seSolapan(r.getHoraInicio(), r.getHoraFin(), hi, hf)) {
                return false;
            }
        }
        return true;
    }

    private boolean estudianteTieneCruce(String estudianteCodigo, Reprogramacion nueva) {
        List<Matricula> cursosEstudiante = matriculaRepository.findByEstudianteCodigo(estudianteCodigo);
        if (cursosEstudiante == null) {
            return false;
        }
        for (Matricula m : cursosEstudiante) {
            if (m.getCurso() == null) {
                continue;
            }
            if (horarioRepository != null && buscarCruceEnHorarios(
                    horarioRepository.findByCurso(m.getCurso()), nueva).isPresent()) {
                return true;
            }
            if (reprogramacionRepository != null && buscarCruceEnReprogramaciones(
                    reprogramacionRepository.findByCurso(m.getCurso()), nueva).isPresent()) {
                return true;
            }
        }
        return false;
    }

    private Optional<Conflicto> detectarConflicto(Reprogramacion nueva) {
        if (nueva == null || nueva.getDocenteCodigo() == null || nueva.getFecha() == null
                || nueva.getHoraInicio() == null || nueva.getHoraFin() == null) {
            return Optional.empty();
        }

        // 1. Validar contra el horario regular del docente
        if (horarioRepository != null) {
            Optional<String> cruceHorario = buscarCruceEnHorarios(
                    horarioRepository.findByDocenteCodigo(nueva.getDocenteCodigo()), nueva);
            if (cruceHorario.isPresent()) {
                return Optional.of(new Conflicto(cruceHorario.get(), null, null));
            }
        }

        // 2. Validar contra reprogramaciones previas del mismo docente
        if (reprogramacionRepository != null) {
            Optional<String> cruceReprog = buscarCruceEnReprogramaciones(
                    reprogramacionRepository.findByDocenteCodigo(nueva.getDocenteCodigo()), nueva);
            if (cruceReprog.isPresent()) {
                return Optional.of(new Conflicto(cruceReprog.get(), null, null));
            }
        }

        // 3. Si el docente está libre, validar contra los horarios y reprogramaciones de los estudiantes matriculados
        if (matriculaRepository != null && nueva.getCurso() != null) {
            List<Matricula> inscritos = matriculaRepository.findByCurso(nueva.getCurso());
            if (inscritos != null) {
                for (Matricula inscrito : inscritos) {
                    String estudianteCodigo = inscrito.getEstudianteCodigo();
                    if (estudianteCodigo == null) {
                        continue;
                    }
                    List<Matricula> cursosEstudiante = matriculaRepository.findByEstudianteCodigo(estudianteCodigo);
                    if (cursosEstudiante == null) {
                        continue;
                    }
                    for (Matricula m : cursosEstudiante) {
                        if (m.getCurso() == null) {
                            continue;
                        }
                        if (horarioRepository != null) {
                            Optional<String> cruceEstHorario = buscarCruceEnHorarios(
                                    horarioRepository.findByCurso(m.getCurso()), nueva);
                            if (cruceEstHorario.isPresent()) {
                                return Optional.of(new Conflicto(cruceEstHorario.get(), estudianteCodigo, null));
                            }
                        }
                        if (reprogramacionRepository != null) {
                            Optional<String> cruceEstReprog = buscarCruceEnReprogramaciones(
                                    reprogramacionRepository.findByCurso(m.getCurso()), nueva);
                            if (cruceEstReprog.isPresent()) {
                                return Optional.of(new Conflicto(cruceEstReprog.get(), estudianteCodigo, null));
                            }
                        }
                    }
                }
            }
        }

        // 4. Validar disponibilidad física del salón si se indicó un aula explícita
        if (nueva.getAula() != null && !nueva.getAula().isBlank()) {
            String aulaSolicitada = nueva.getAula().trim().toUpperCase();
            if (horarioRepository != null) {
                List<Horario> mismosSalones = horarioRepository.findAll().stream()
                        .filter(h -> h.getAula() != null && aulaSolicitada.equalsIgnoreCase(h.getAula().trim()))
                        .toList();
                Optional<String> cruceSalonHorario = buscarCruceEnHorarios(mismosSalones, nueva);
                if (cruceSalonHorario.isPresent()) {
                    return Optional.of(new Conflicto(cruceSalonHorario.get(), null, aulaSolicitada));
                }
            }
            if (reprogramacionRepository != null) {
                List<Reprogramacion> mismasReprogs = reprogramacionRepository.findAll().stream()
                        .filter(r -> !"RECHAZADO".equalsIgnoreCase(r.getEstado()))
                        .filter(r -> r.getAula() != null && aulaSolicitada.equalsIgnoreCase(r.getAula().trim()))
                        .toList();
                Optional<String> cruceSalonReprog = buscarCruceEnReprogramaciones(mismasReprogs, nueva);
                if (cruceSalonReprog.isPresent()) {
                    return Optional.of(new Conflicto(cruceSalonReprog.get(), null, aulaSolicitada));
                }
            }
        }

        return Optional.empty();
    }

    private Optional<String> buscarCruceEnHorarios(List<Horario> horarios, Reprogramacion nueva) {
        if (horarios == null) {
            return Optional.empty();
        }
        DayOfWeek diaDeLaFecha = nueva.getFecha().getDayOfWeek();
        for (Horario h : horarios) {
            if (h.getDia() != null && h.getDia() == diaDeLaFecha) {
                if (seSolapan(h.getHoraInicio(), h.getHoraFin(), nueva.getHoraInicio(), nueva.getHoraFin())) {
                    return Optional.ofNullable(h.getCurso());
                }
            }
        }
        return Optional.empty();
    }

    private Optional<String> buscarCruceEnReprogramaciones(List<Reprogramacion> previas, Reprogramacion nueva) {
        if (previas == null) {
            return Optional.empty();
        }
        for (Reprogramacion r : previas) {
            if ("RECHAZADO".equalsIgnoreCase(r.getEstado())) {
                continue;
            }
            if (nueva.getId() != null && nueva.getId().equals(r.getId())) {
                continue;
            }
            if (nueva.getFecha().equals(r.getFecha())) {
                if (seSolapan(r.getHoraInicio(), r.getHoraFin(), nueva.getHoraInicio(), nueva.getHoraFin())) {
                    return Optional.ofNullable(r.getCurso());
                }
            }
        }
        return Optional.empty();
    }

    private Optional<String> buscarViolacionTrasladoEnHorarios(List<Horario> horarios, Reprogramacion nueva) {
        if (horarios == null) {
            return Optional.empty();
        }
        DayOfWeek diaDeLaFecha = nueva.getFecha().getDayOfWeek();
        for (Horario h : horarios) {
            if (h.getDia() != null && h.getDia() == diaDeLaFecha
                    && !seSolapan(h.getHoraInicio(), h.getHoraFin(), nueva.getHoraInicio(), nueva.getHoraFin())) {
                long gap = calcularIntervaloMinutos(h.getHoraInicio(), h.getHoraFin(), nueva.getHoraInicio(), nueva.getHoraFin());
                if (gap < INTERVALO_TRASLADO_MIN) {
                    return Optional.of("Intervalo de traslado docente insuficiente (" + gap
                            + " min): se requieren al menos 15 minutos con " + h.getCurso()
                            + " (" + h.getHoraInicio() + "–" + h.getHoraFin() + ").");
                }
            }
        }
        return Optional.empty();
    }

    private Optional<String> buscarViolacionTrasladoEnReprogramaciones(List<Reprogramacion> previas, Reprogramacion nueva) {
        if (previas == null) {
            return Optional.empty();
        }
        for (Reprogramacion r : previas) {
            if ("RECHAZADO".equalsIgnoreCase(r.getEstado())) {
                continue;
            }
            if (nueva.getId() != null && nueva.getId().equals(r.getId())) {
                continue;
            }
            if (nueva.getFecha().equals(r.getFecha())
                    && !seSolapan(r.getHoraInicio(), r.getHoraFin(), nueva.getHoraInicio(), nueva.getHoraFin())) {
                long gap = calcularIntervaloMinutos(r.getHoraInicio(), r.getHoraFin(), nueva.getHoraInicio(), nueva.getHoraFin());
                if (gap < INTERVALO_TRASLADO_MIN) {
                    return Optional.of("Intervalo de traslado docente insuficiente (" + gap
                            + " min): se requieren al menos 15 minutos con la recuperación de " + r.getCurso() + ".");
                }
            }
        }
        return Optional.empty();
    }

    private long calcularIntervaloMinutos(LocalTime ini1, LocalTime fin1, LocalTime ini2, LocalTime fin2) {
        if (ini1 == null || fin1 == null || ini2 == null || fin2 == null) {
            return Long.MAX_VALUE;
        }
        if (!ini2.isBefore(fin1)) {
            return Duration.between(fin1, ini2).toMinutes();
        }
        if (!ini1.isBefore(fin2)) {
            return Duration.between(fin2, ini1).toMinutes();
        }
        return 0;
    }

    public boolean seSolapan(LocalTime inicio1, LocalTime fin1, LocalTime inicio2, LocalTime fin2) {
        if (inicio1 == null || fin1 == null || inicio2 == null || fin2 == null) {
            return false;
        }
        return inicio1.isBefore(fin2) && inicio2.isBefore(fin1);
    }
}
