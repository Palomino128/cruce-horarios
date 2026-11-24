# Frontend — Sistema de Cruce de Horarios UTP Arequipa

Aplicación SPA construida con **Angular 22.1** (Standalone Components, Zoneless Change Detection, Angular Signals y SCSS) para el **Sistema de Verificación de Cruce de Horarios Académicos — UTP Arequipa**.

> Consulta el [README principal](../README.md) en la raíz del repositorio para la arquitectura completa, reglas académicas, backend Spring Boot y pipeline ETL de datos.

## Módulos y Rutas Principales

- `/login` — Inicio de sesión institucional por rol (`Estudiante`, `Docente`, `Coordinador Académico`).
- `/consulta-horario` — Horario regular y recuperaciones en **Vista Tabla** y **Calendario Semanal (Lun–Dom)** con sede y nivel por aula.
- `/registro-reprogramacion` — Reprogramación de clases con alertas en vivo (franja horaria, traslado de 15 min, 3 sedes/sótanos, `INSCRITOS <= AFORO`), recomendaciones por `%` de asistencia y matriz semanal de salones.
- `/base-horarios` — Explorador paginado de los `10,227` horarios presenciales importados y validador interactivo de disponibilidad y capacidad (`INSCRITOS <= AFORO`).
- `/confirmacion` — Constancia oficial imprimible, confirmación/rechazo y exportación CSV.
- `/gestion` — Panel ejecutivo de Coordinación Académica (KPIs, aprobación/rechazo, reporte consolidado CSV, gestión de docentes, horarios y matrículas).

## Comandos

```powershell
# Instalar dependencias
npm install

# Servidor de desarrollo (http://localhost:4200, requiere backend en :8082)
npx ng serve

# Compilación de producción (dist/frontend-horarios/browser/)
npx ng build
```

Para servir la versión compilada de forma unificada en `http://localhost:8082`, copia los archivos generados en `dist/frontend-horarios/browser/` hacia `../src/main/resources/static/`.
