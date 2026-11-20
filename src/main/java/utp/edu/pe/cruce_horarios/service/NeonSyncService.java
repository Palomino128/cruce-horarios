package utp.edu.pe.cruce_horarios.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class NeonSyncService {

    private static final Logger log = LoggerFactory.getLogger(NeonSyncService.class);
    private static final Set<String> TABLAS_VALIDAS = Set.of(
            "docentes", "estudiantes", "horarios", "matriculas", "reprogramaciones"
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
                    estado VARCHAR(30) DEFAULT 'SOLICITADO'
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

    private boolean estaConfigurado() {
        return syncEnabled
                && neonHttpUrl != null && !neonHttpUrl.isBlank()
                && neonConnectionString != null && !neonConnectionString.isBlank()
                && !neonConnectionString.contains("***");
    }
}
