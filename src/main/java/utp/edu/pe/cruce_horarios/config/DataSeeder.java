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
import utp.edu.pe.cruce_horarios.model.Matricula;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;
import utp.edu.pe.cruce_horarios.repository.DocenteRepository;
import utp.edu.pe.cruce_horarios.repository.EstudianteRepository;
import utp.edu.pe.cruce_horarios.repository.HorarioRepository;
import utp.edu.pe.cruce_horarios.repository.MatriculaRepository;
import utp.edu.pe.cruce_horarios.repository.ReprogramacionRepository;
import utp.edu.pe.cruce_horarios.service.NeonSyncService;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
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

    private final HorarioRepository horarioRepository;
    private final DocenteRepository docenteRepository;
    private final EstudianteRepository estudianteRepository;
    private final MatriculaRepository matriculaRepository;
    private final ReprogramacionRepository reprogramacionRepository;
    private final NeonSyncService neonSyncService;

    @Autowired
    public DataSeeder(HorarioRepository horarioRepository,
                      DocenteRepository docenteRepository,
                      EstudianteRepository estudianteRepository,
                      MatriculaRepository matriculaRepository,
                      ReprogramacionRepository reprogramacionRepository,
                      @Autowired(required = false) NeonSyncService neonSyncService) {
        this.horarioRepository = horarioRepository;
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

        if (neonSyncService != null && neonSyncService.estaConfigurado() && reprogramacionRepository.count() == 0) {
            List<Reprogramacion> remotas = neonSyncService.cargarReprogramacionesDesdeNeon();
            if (!remotas.isEmpty()) {
                reprogramacionRepository.saveAll(remotas);
                log.info("Sincronizadas {} reprogramaciones guardadas desde Neon PostgreSQL.", remotas.size());
            }
        }
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
