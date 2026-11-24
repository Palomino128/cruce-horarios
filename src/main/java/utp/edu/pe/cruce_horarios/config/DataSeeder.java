package utp.edu.pe.cruce_horarios.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import utp.edu.pe.cruce_horarios.model.Docente;
import utp.edu.pe.cruce_horarios.model.Estudiante;
import utp.edu.pe.cruce_horarios.model.Horario;
import utp.edu.pe.cruce_horarios.model.HorarioPresencial;
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;
import utp.edu.pe.cruce_horarios.repository.DocenteRepository;
import utp.edu.pe.cruce_horarios.repository.EstudianteRepository;
import utp.edu.pe.cruce_horarios.repository.HorarioPresencialRepository;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import utp.edu.pe.cruce_horarios.repository.ReprogramacionRepository;
import utp.edu.pe.cruce_horarios.service.NeonSyncService;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final int MIN_ESTUDIANTES_REALISTAS = 3000;
    private static final int MIN_MATRICULAS_COHORTES = 3400;
    private static final int MIN_HORARIOS_PRESENCIALES = 10000;

    private final HorarioRepository horarioRepository;
    private final HorarioPresencialRepository horarioPresencialRepository;
    private final DocenteRepository docenteRepository;
    private final EstudianteRepository estudianteRepository;
    private final MatriculaRepository matriculaRepository;
    private final ReprogramacionRepository reprogramacionRepository;
    private final NeonSyncService neonSyncService;

    @Autowired
    public DataSeeder(HorarioRepository horarioRepository,
                      HorarioPresencialRepository horarioPresencialRepository,
                      DocenteRepository docenteRepository,
                      EstudianteRepository estudianteRepository,
                      MatriculaRepository matriculaRepository,
                      ReprogramacionRepository reprogramacionRepository,
                      @Autowired(required = false) NeonSyncService neonSyncService) {
        this.horarioRepository = horarioRepository;
        this.horarioPresencialRepository = horarioPresencialRepository;
        this.docenteRepository = docenteRepository;
        this.estudianteRepository = estudianteRepository;
        this.matriculaRepository = matriculaRepository;
        this.reprogramacionRepository = reprogramacionRepository;
        this.neonSyncService = neonSyncService;
    }

    @Override
    @Transactional
    public void run(String... args) {
        boolean catalogoCompleto = estudianteRepository.count() >= MIN_ESTUDIANTES_REALISTAS
                && matriculaRepository.count() >= MIN_MATRICULAS_COHORTES
                && docenteRepository.findByCodigo("COORD-01").isPresent();

        if (!catalogoCompleto) {
            matriculaRepository.deleteAllInBatch();
            horarioRepository.deleteAllInBatch();
            estudianteRepository.deleteAllInBatch();
            docenteRepository.deleteAllInBatch();

            List<Docente> docentes = leerCsv("data/docentes.csv", cols ->
                    new Docente(cols[0], cols[1], cols[2]));
            List<Horario> horarios = leerCsv("data/horarios.csv", cols ->
                    new Horario(cols[0], cols[1], DayOfWeek.valueOf(cols[2]),
                            LocalTime.parse(cols[3]), LocalTime.parse(cols[4]), cols[5]));
            List<Estudiante> estudiantes = leerCsv("data/estudiantes.csv", cols ->
                    new Estudiante(cols[0], cols[1], cols[2]));
            List<Matricula> matriculas = leerCsv("data/matriculas.csv", cols ->
                    new Matricula(cols[0], cols[1]));

            docenteRepository.saveAll(docentes);
            horarioRepository.saveAll(horarios);
            estudianteRepository.saveAll(estudiantes);
            matriculaRepository.saveAll(matriculas);

            log.info("Catálogo académico sembrado: {} docentes, {} horarios/cursos, {} estudiantes, {} matrículas.",
                    docentes.size(), horarios.size(), estudiantes.size(), matriculas.size());
        }

        if (horarioPresencialRepository != null && horarioPresencialRepository.count() < MIN_HORARIOS_PRESENCIALES) {
            ClassPathResource csvPresencial = new ClassPathResource("data/horarios_presenciales.csv");
            if (csvPresencial.exists()) {
                horarioPresencialRepository.deleteAllInBatch();
                List<HorarioPresencial> presenciales = leerCsv("data/horarios_presenciales.csv", this::mapearHorarioPresencial);
                int lote = 1000;
                for (int i = 0; i < presenciales.size(); i += lote) {
                    horarioPresencialRepository.saveAll(presenciales.subList(i, Math.min(i + lote, presenciales.size())));
                }
                log.info("Base presencial sembrada desde horarios_presenciales.csv: {} registros.", presenciales.size());
            }
        }

        if (neonSyncService != null && neonSyncService.estaConfigurado() && reprogramacionRepository.count() == 0) {
            List<Reprogramacion> remotas = neonSyncService.cargarReprogramacionesDesdeNeon();
            if (!remotas.isEmpty()) {
                reprogramacionRepository.saveAll(remotas);
                log.info("Sincronizadas {} reprogramaciones guardadas desde Neon PostgreSQL.", remotas.size());
            }
        }
    }

    private HorarioPresencial mapearHorarioPresencial(String[] cols) {
        HorarioPresencial h = new HorarioPresencial();
        h.setCoordinadorCurso(nuloSiVacio(cols, 0));
        h.setCodDocente(nuloSiVacio(cols, 1));
        h.setNomDocente(nuloSiVacio(cols, 2));
        h.setCodCurso(nuloSiVacio(cols, 3));
        h.setCurso(nuloSiVacio(cols, 4));
        h.setCatalogo(nuloSiVacio(cols, 5));
        h.setCiclo(nuloSiVacio(cols, 6));
        h.setSeccion(nuloSiVacio(cols, 7));
        h.setCarrera(nuloSiVacio(cols, 8));
        h.setModalidad(nuloSiVacio(cols, 9));
        h.setTipoClase(nuloSiVacio(cols, 10));
        String aforoTxt = nuloSiVacio(cols, 11);
        h.setAforo(aforoTxt == null ? null : Integer.parseInt(aforoTxt));
        String inscTxt = nuloSiVacio(cols, 12);
        h.setInscritos(inscTxt == null ? null : Integer.parseInt(inscTxt));
        h.setGrado(nuloSiVacio(cols, 13));
        h.setDiaClase(nuloSiVacio(cols, 14));
        String hiTxt = nuloSiVacio(cols, 15);
        h.setHoraInicio(hiTxt == null ? null : LocalTime.parse(hiTxt));
        String hfTxt = nuloSiVacio(cols, 16);
        h.setHoraFin(hfTxt == null ? null : LocalTime.parse(hfTxt));
        String hpTxt = nuloSiVacio(cols, 17);
        h.setHorasProg(hpTxt == null ? null : new BigDecimal(hpTxt));
        h.setClase(nuloSiVacio(cols, 18));
        h.setTiempoTrasladoMin(15);
        return h;
    }

    private String nuloSiVacio(String[] cols, int idx) {
        if (cols == null || idx >= cols.length || cols[idx] == null) {
            return null;
        }
        String t = cols[idx].trim();
        return t.isEmpty() ? null : t;
    }

    private <T> List<T> leerCsv(String rutaClasspath, Function<String[], T> mapper) {
        ClassPathResource resource = new ClassPathResource(rutaClasspath);
        List<T> lista = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String linea;
            boolean esCabecera = true;
            while ((linea = reader.readLine()) != null) {
                String limpia = linea.trim();
                if (limpia.isEmpty()) {
                    continue;
                }
                if (esCabecera) {
                    esCabecera = false;
                    continue;
                }
                String[] cols = limpia.split(";", -1);
                lista.add(mapper.apply(cols));
            }
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo leer el recurso CSV: " + rutaClasspath, ex);
        }
        return lista;
    }
}
