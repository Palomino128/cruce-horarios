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
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class CruceHorarioService {

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

    public boolean seSolapan(LocalTime inicio1, LocalTime fin1, LocalTime inicio2, LocalTime fin2) {
        if (inicio1 == null || fin1 == null || inicio2 == null || fin2 == null) {
            return false;
        }
        return inicio1.isBefore(fin2) && inicio2.isBefore(fin1);
    }
}
