package utp.edu.pe.cruce_horarios.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import utp.edu.pe.cruce_horarios.model.Reprogramacion;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class NeonSyncService {

    private static final Logger log = LoggerFactory.getLogger(NeonSyncService.class);
    private static final Set<String> TABLAS_VALIDAS = Set.of(
            "docentes", "estudiantes", "horarios", "matriculas", "reprogramaciones", "horarios_presenciales"
    );

    private final boolean syncEnabled;
    private final String neonHttpUrl;
    private final String neonConnectionString;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public NeonSyncService(
            @Value("${neon.sync.enabled:false}") boolean syncEnabled,
            @Value("${neon.http.url:}") String neonHttpUrl,
            @Value("${neon.connection.string:}") String neonConnectionString) {
        this.syncEnabled = syncEnabled;
        this.neonHttpUrl = neonHttpUrl;
        this.neonConnectionString = neonConnectionString;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void inicializarEsquema() {
        if (!estaConfigurado()) {
            return;
        }
        ejecutar("""
                CREATE TABLE IF NOT EXISTS docentes (
                    id SERIAL PRIMARY KEY,
                    codigo VARCHAR(50) UNIQUE NOT NULL,
                    nombres VARCHAR(150),
                    apellidos VARCHAR(150)
                )
                """, List.of());

        ejecutar("""
                CREATE TABLE IF NOT EXISTS estudiantes (
                    id SERIAL PRIMARY KEY,
                    codigo VARCHAR(50) UNIQUE NOT NULL,
                    nombres VARCHAR(150),
                    apellidos VARCHAR(150)
                )
                """, List.of());

        ejecutar("""
                CREATE TABLE IF NOT EXISTS horarios (
                    id SERIAL PRIMARY KEY,
                    docente_codigo VARCHAR(50) NOT NULL,
                    curso VARCHAR(150) NOT NULL,
                    dia VARCHAR(20) NOT NULL,
                    hora_inicio VARCHAR(20) NOT NULL,
                    hora_fin VARCHAR(20) NOT NULL,
                    aula VARCHAR(50)
                )
                """, List.of());

        ejecutar("""
                CREATE TABLE IF NOT EXISTS matriculas (
                    id SERIAL PRIMARY KEY,
                    estudiante_codigo VARCHAR(50) NOT NULL,
                    curso VARCHAR(150) NOT NULL
                )
                """, List.of());

        ejecutar("""
                CREATE TABLE IF NOT EXISTS reprogramaciones (
                    id SERIAL PRIMARY KEY,
                    docente_codigo VARCHAR(50) NOT NULL,
                    curso VARCHAR(150) NOT NULL,
                    fecha VARCHAR(20) NOT NULL,
                    hora_inicio VARCHAR(20) NOT NULL,
                    hora_fin VARCHAR(20) NOT NULL,
                    aula VARCHAR(50),
                    estado VARCHAR(30) DEFAULT 'SOLICITADO',
                    motivo VARCHAR(250),
                    observacion_coordinador VARCHAR(250),
                    porcentaje_asistencia DOUBLE PRECISION
                )
                """, List.of());

        ejecutar("ALTER TABLE reprogramaciones ADD COLUMN IF NOT EXISTS motivo VARCHAR(250)", List.of());
        ejecutar("ALTER TABLE reprogramaciones ADD COLUMN IF NOT EXISTS observacion_coordinador VARCHAR(250)", List.of());
        ejecutar("ALTER TABLE reprogramaciones ADD COLUMN IF NOT EXISTS porcentaje_asistencia DOUBLE PRECISION", List.of());

        ejecutar("""
                CREATE TABLE IF NOT EXISTS horarios_presenciales (
                    id SERIAL PRIMARY KEY,
                    coordinador_curso VARCHAR(150) NULL,
                    cod_docente VARCHAR(30) NULL,
                    nom_docente VARCHAR(150) NULL,
                    cod_curso VARCHAR(30) NOT NULL,
                    curso VARCHAR(200) NOT NULL,
                    catalogo VARCHAR(50),
                    ciclo VARCHAR(20),
                    seccion VARCHAR(30),
                    carrera VARCHAR(150),
                    modalidad VARCHAR(40),
                    tipo_clase VARCHAR(80) NULL,
                    aforo INTEGER,
                    inscritos INTEGER,
                    grado VARCHAR(30),
                    dia_clase VARCHAR(30),
                    hora_inicio TIME,
                    hora_fin TIME,
                    horas_prog NUMERIC(6, 2),
                    clase VARCHAR(50),
                    tiempo_traslado_min INTEGER DEFAULT 15
                )
                """, List.of());

        log.info("Esquema online verificado en Neon PostgreSQL ({}).",
                enmascararCredenciales(neonConnectionString));
    }

    public static String enmascararCredenciales(String cadenaConexion) {
        if (cadenaConexion == null || cadenaConexion.isBlank()) {
            return "********";
        }
        return cadenaConexion.replaceAll("(://[^:/@]+:)[^@]+(@)", "$1********$2");
    }

    public void sincronizarReprogramacionInsert(Reprogramacion r) {
        if (!estaConfigurado() || r == null) {
            return;
        }
        String pctStr = r.getPorcentajeAsistencia() == null ? "100.0" : String.valueOf(r.getPorcentajeAsistencia());
        ejecutar("""
                INSERT INTO reprogramaciones
                    (docente_codigo, curso, fecha, hora_inicio, hora_fin, aula, estado, motivo, observacion_coordinador, porcentaje_asistencia)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CAST($10 AS DOUBLE PRECISION))
                """,
                List.of(
                        valorSeguro(r.getDocenteCodigo()),
                        valorSeguro(r.getCurso()),
                        valorSeguro(r.getFecha()),
                        horaTexto(r.getHoraInicio()),
                        horaTexto(r.getHoraFin()),
                        valorSeguro(r.getAula()),
                        valorSeguro(r.getEstado() == null ? "SOLICITADO" : r.getEstado()),
                        valorSeguro(r.getMotivo()),
                        valorSeguro(r.getObservacionCoordinador()),
                        pctStr
                ));
    }

    public void sincronizarReprogramacionEstado(Reprogramacion r) {
        if (!estaConfigurado() || r == null) {
            return;
        }
        ejecutar("""
                UPDATE reprogramaciones
                   SET estado = $1,
                       observacion_coordinador = $2
                 WHERE docente_codigo = $3
                   AND curso = $4
                   AND fecha = $5
                   AND hora_inicio = $6
                   AND hora_fin = $7
                """,
                List.of(
                        valorSeguro(r.getEstado()),
                        valorSeguro(r.getObservacionCoordinador()),
                        valorSeguro(r.getDocenteCodigo()),
                        valorSeguro(r.getCurso()),
                        valorSeguro(r.getFecha()),
                        horaTexto(r.getHoraInicio()),
                        horaTexto(r.getHoraFin())
                ));
    }

    public void eliminarReprogramacionNeon(Reprogramacion r) {
        if (!estaConfigurado() || r == null) {
            return;
        }
        ejecutar("""
                DELETE FROM reprogramaciones
                 WHERE docente_codigo = $1
                   AND curso = $2
                   AND fecha = $3
                   AND hora_inicio = $4
                   AND hora_fin = $5
                """,
                List.of(
                        valorSeguro(r.getDocenteCodigo()),
                        valorSeguro(r.getCurso()),
                        valorSeguro(r.getFecha()),
                        horaTexto(r.getHoraInicio()),
                        horaTexto(r.getHoraFin())
                ));
    }

    public List<Reprogramacion> cargarReprogramacionesDesdeNeon() {
        List<Reprogramacion> resultado = new ArrayList<>();
        if (!estaConfigurado()) {
            return resultado;
        }
        JsonNode rows = consultarFilas("""
                SELECT docente_codigo, curso, fecha, hora_inicio, hora_fin, aula, estado, motivo, observacion_coordinador, porcentaje_asistencia
                  FROM reprogramaciones
                 ORDER BY id ASC
                """, List.of());
        if (!rows.isArray()) {
            return resultado;
        }
        for (JsonNode row : rows) {
            try {
                Reprogramacion r = new Reprogramacion();
                r.setDocenteCodigo(texto(row, "docente_codigo"));
                r.setCurso(texto(row, "curso"));
                r.setFecha(LocalDate.parse(texto(row, "fecha")));
                r.setHoraInicio(LocalTime.parse(horaNormalizada(texto(row, "hora_inicio"))));
                r.setHoraFin(LocalTime.parse(horaNormalizada(texto(row, "hora_fin"))));
                String aula = texto(row, "aula");
                r.setAula(aula.isBlank() ? null : aula);
                String estado = texto(row, "estado");
                r.setEstado(estado.isBlank() ? "SOLICITADO" : estado);
                String motivo = texto(row, "motivo");
                r.setMotivo(motivo.isBlank() ? null : motivo);
                String obs = texto(row, "observacion_coordinador");
                r.setObservacionCoordinador(obs.isBlank() ? null : obs);
                JsonNode pctNode = row.path("porcentaje_asistencia");
                if (!pctNode.isMissingNode() && !pctNode.isNull()) {
                    String pctTxt = pctNode.asText("").trim();
                    if (!pctTxt.isEmpty()) {
                        r.setPorcentajeAsistencia(Double.parseDouble(pctTxt));
                    }
                }
                resultado.add(r);
            } catch (Exception ex) {
                log.warn("No se pudo reconstruir una fila de reprogramaciones desde Neon: {}", ex.getMessage());
            }
        }
        return resultado;
    }

    public JsonNode consultarFilas(String query, List<String> params) {
        ArrayNode vacio = objectMapper.createArrayNode();
        if (!estaConfigurado()) {
            return vacio;
        }
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("query", query);
            payload.put("params", params == null ? Collections.emptyList() : params);
            String json = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(neonHttpUrl))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .header("Neon-Connection-String", neonConnectionString)
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode rows = root.path("rows");
                return rows.isArray() ? rows : vacio;
            }
            log.error("Error HTTP {} al consultar Neon PostgreSQL: {}", response.statusCode(), response.body());
        } catch (Exception ex) {
            log.error("Error comunicándose con Neon PostgreSQL: {}", ex.getMessage(), ex);
        }
        return vacio;
    }

    public void ejecutar(String query, List<String> params) {
        consultarFilas(query, params);
    }

    public long contarFilas(String tabla) {
        if (!estaConfigurado() || tabla == null || !TABLAS_VALIDAS.contains(tabla)) {
            return 0;
        }
        JsonNode rows = consultarFilas("SELECT COUNT(*)::int AS total FROM " + tabla, List.of());
        if (rows.isArray() && !rows.isEmpty()) {
            return rows.get(0).path("total").asLong(0);
        }
        return 0;
    }

    public String valorSeguro(Object valor) {
        return valor == null ? "" : String.valueOf(valor);
    }

    public String texto(JsonNode row, String campo) {
        JsonNode nodo = row.path(campo);
        return nodo.isMissingNode() || nodo.isNull() ? "" : nodo.asText("");
    }

    private String horaTexto(LocalTime hora) {
        if (hora == null) {
            return "";
        }
        String str = hora.toString();
        return str.length() == 5 ? str + ":00" : str;
    }

    private String horaNormalizada(String hora) {
        if (hora == null) {
            return "00:00";
        }
        return hora.length() >= 5 ? hora.substring(0, 5) : hora;
    }

    public boolean estaConfigurado() {
        return syncEnabled
                && neonHttpUrl != null && !neonHttpUrl.isBlank()
                && neonConnectionString != null && !neonConnectionString.isBlank()
                && !neonConnectionString.contains("***");
    }
}
