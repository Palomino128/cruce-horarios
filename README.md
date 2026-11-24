# Sistema de Verificación de Cruce de Horarios Académicos — UTP Arequipa

Aplicación web Full-Stack para la consulta de horarios académicos, gestión de reprogramaciones/recuperaciones de clases sin cruces, validación de capacidad de aulas (`INSCRITOS <= AFORO`) y aprobación oficial por Coordinación de Ingeniería en la **Universidad Tecnológica del Perú (UTP — Sede Arequipa)**.

---

## Tecnologías Utilizadas

- **Backend:** Java 21, Spring Boot `4.1.1`, Spring Data JPA, Spring Validation, SpringDoc OpenAPI (Swagger UI), JaCoCo.
- **Frontend:** Angular `22.1` (Standalone Components, Zoneless, Signals), TypeScript `6.0`, SCSS con paleta institucional UTP (Azul Marino `#0b2545`, Celeste `#0284c7`, Blanco `#ffffff`).
- **Base de Datos:** PostgreSQL en la nube (**Neon PostgreSQL**) con respaldo automático en memoria (**H2**) para desarrollo local sin configuración adicional.
- **Carga y Limpieza de Datos (ETL):** Python (`openpyxl`) para importar y depurar la base institucional desde Excel (`02_subir_neon.py`).

---

## Reglas Académicas y de Negocio Implementadas

1. **Bloques y Franja Horaria Universitaria:**
   - Hora académica de **45 minutos** (sesiones de 45, 90, 135 min...).
   - **Lunes a Sábado:** `07:00 am` a `10:30 pm` (`22:30`).
   - **Domingos:** `07:00 am` a `02:00 pm` (`14:00`).
2. **Traslado Docente:**
   - Intervalo mínimo obligatorio de **15 minutos** entre sesiones consecutivas de un mismo docente.
3. **Porcentaje de Asistencia y Recomendaciones:**
   - Calcula automáticamente el porcentaje de estudiantes matriculados sin cruce en cada fecha y franja.
   - Recomienda horarios con asistencia **> 50%**, manteniendo visibles todas las alternativas ordenadas por asistencia estimada.
4. **Infraestructura de las 3 Sedes UTP Arequipa y Aulas Subterráneas (`S`):**
   - **Sede Tacna y Arica:** pabellones `A` y `B`; aulas subterráneas en **piso `-1`** con `S` después del pabellón (ej. `AS101`, `BS102`).
   - **Sede Parra 1:** pabellones `C`, `D`, `E`, `F` y `G`; aulas subterráneas **hasta piso `-2`** (ej. `CS101`, `DS201`).
   - **Sede Parra 2:** pabellones `H` e `I`; aulas subterráneas **hasta piso `-2`** (ej. `HS101`, `HS201`, `IS202`).
5. **Base Presencial Completa (`10,227` registros) y Regla `INSCRITOS <= AFORO`:**
   - Importa los **10,227 registros válidos** de `data (25).xlsx` (hoja `Export`), descartando las 2 filas de pie de página e ignorando `NUM_CLASE`, `MODULO`, `EDIFICIO` y `CATEGORIA`.
   - Conserva las **19 columnas** oficiales (permitiendo `NULL` en `COORDINADOR_CURSO`, `COD_DOCENTE`, `NOM_DOCENTE` y `TIPO_CLASE`).
   - Limpia los códigos de aula (`CLASE`) eliminando los 2 primeros caracteres (ej. `38A0102` → `A0102`, `77GS0104` → `GS0104`, `84J0202` → `J0202`).
   - Valida en backend y frontend que el salón no esté ocupado en el día/franja solicitada y que `INSCRITOS <= AFORO`, alertando automáticamente en caso de sobrecupo y sugiriendo aulas libres con capacidad suficiente.

---

## Estructura del Proyecto

```text
Cruce_de_Horario/
├── 02_subir_neon.py                         # Script ETL Python (Excel -> CSV H2 + Neon PostgreSQL)
├── pom.xml                                  # Configuración Maven (Spring Boot 4.1.1 / Java 21)
├── .env.example                             # Plantilla de variables de entorno (sin secretos)
├── src/
│   ├── main/java/utp/edu/pe/cruce_horarios/
│   │   ├── config/DataSeeder.java           # Sembrado automático en H2 (catálogo + 10,227 horarios)
│   │   ├── controller/                      # Auth, Docentes, Estudiantes, Horarios, HorariosPresenciales
│   │   ├── model/                           # Entidades JPA (Horario, HorarioPresencial, Reprogramacion, etc.)
│   │   ├── repository/                      # Repositorios Spring Data JPA
│   │   └── service/                         # CruceHorarioService, NeonSyncService
│   ├── main/resources/
│   │   ├── data/                            # CSVs de respaldo (incl. horarios_presenciales.csv)
│   │   └── static/                          # Bundle compilado de Angular servido en :8082
│   └── test/java/                           # Pruebas unitarias (JUnit 5 + Mockito)
└── frontend-horarios/                       # Aplicación Angular 22
    └── src/app/
        ├── components/
        │   ├── acceso-registro/             # Inicio de sesión por rol
        │   ├── consulta-horario/            # Vista Tabla y Calendario Semanal (Lun–Dom)
        │   ├── registro-reprogramacion/     # Reprogramación, recomendaciones y matriz de salones
        │   ├── base-presencial/             # Consulta de 10,227 registros y validador AFORO/INSCRITOS
        │   ├── confirmacion/                # Constancia imprimible, aprobación/rechazo y CSV
        │   └── gestion-usuarios/            # Panel de Coordinación Académica
        ├── guards/                          # Protección de rutas por sesión y rol
        ├── models/                          # Interfaces TypeScript
        ├── services/                        # Servicios HTTP hacia Spring Boot
        └── utils/sedes-utp.util.ts          # Reglas y etiquetas de las 3 sedes UTP
```

---

## Configuración Inicial

1. Copia `.env.example` como `.env` (ignorado por Git) si deseas conectar con **Neon PostgreSQL**:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Completa tus credenciales reales en `.env`. Si no defines variables de entorno, el backend arranca automáticamente con **H2 en memoria** sembrando todos los catálogos y los `10,227` horarios presenciales.

---

## Ejecución del Proyecto

### 1. Servidor Unificado (Backend + Frontend en `http://localhost:8082`)
En Windows (CMD o PowerShell):
```cmd
mvnw.cmd spring-boot:run
```
- Aplicación web: `http://localhost:8082`
- Documentación Swagger / OpenAPI: `http://localhost:8082/swagger-ui.html`
- Estado del servicio: `http://localhost:8082/actuator/health`

### 2. Pruebas Unitarias (Backend)
```cmd
mvnw.cmd test
```

### 3. Desarrollo / Compilación del Frontend Angular
```powershell
cd frontend-horarios
npm install
npx ng serve        # Servidor de desarrollo en http://localhost:4200
npx ng build        # Compilación de producción (copiar dist/frontend-horarios/browser/* a src/main/resources/static/)
```

### 4. Reimportar Excel `data (25).xlsx` a Neon PostgreSQL y CSV H2
```powershell
python 02_subir_neon.py
```

---

## Principales Endpoints REST

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autenticación por rol (`Coordinador Académico`, `Docente`, `Estudiante`) |
| `GET` | `/api/horarios/{codigo}` | Horario regular de un docente |
| `GET` | `/api/horarios/estudiantes/{codigo}` | Horario regular de un estudiante según sus matrículas |
| `POST` | `/api/horarios/reprogramaciones` | Valida reglas académicas, sede, aforo y registra reprogramación |
| `GET` | `/api/horarios/recomendaciones` | Evalúa fechas/horarios con porcentaje de asistencia (`> 50%` recomendados) |
| `PUT` | `/api/horarios/reprogramaciones/{id}/confirmar` | Confirmación oficial por Coordinación |
| `PUT` | `/api/horarios/reprogramaciones/{id}/rechazar` | Rechazo con observación por Coordinación |
| `GET` | `/api/horarios-presenciales` | Búsqueda paginada de los `10,227` registros importados |
| `GET` | `/api/horarios-presenciales/resumen` | Conteo total, salones limpios únicos (`CLASE`) y casos de sobrecupo |
| `GET` | `/api/horarios-presenciales/aulas` | Catálogo de salones limpios con su `AFORO` máximo |
| `POST` | `/api/horarios-presenciales/validar-asignacion` | Valida disponibilidad del salón y capacidad (`INSCRITOS <= AFORO`) con sugerencias |
