import csv
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

import openpyxl


BASE_DIR = Path(__file__).resolve().parent
CSV_OUTPUT = BASE_DIR / "src" / "main" / "resources" / "data" / "horarios_presenciales.csv"

COLUMNAS_IGNORADAS = {"NUM_CLASE", "MODULO", "EDIFICIO", "CATEGORIA"}
COLUMNAS_CONSERVADAS = [
    "COORDINADOR_CURSO",
    "COD_DOCENTE",
    "NOM_DOCENTE",
    "COD_CURSO",
    "CURSO",
    "CATALOGO",
    "CICLO",
    "SECCION",
    "CARRERA",
    "MODALIDAD",
    "TIPO_CLASE",
    "AFORO",
    "INSCRITOS",
    "GRADO",
    "DIA_CLASE",
    "HORA INICIO",
    "HORA FIN",
    "HORAS_PROG",
    "CLASE",
]

COLUMNAS_SQL = [
    "coordinador_curso",
    "cod_docente",
    "nom_docente",
    "cod_curso",
    "curso",
    "catalogo",
    "ciclo",
    "seccion",
    "carrera",
    "modalidad",
    "tipo_clase",
    "aforo",
    "inscritos",
    "grado",
    "dia_clase",
    "hora_inicio",
    "hora_fin",
    "horas_prog",
    "clase",
    "tiempo_traslado_min",
]


def enmascarar_credenciales(url: str) -> str:
    """Oculta la contraseña en cualquier URL PostgreSQL mostrándola como ********."""
    if not url:
        return ""
    return re.sub(r"(://[^:/@]+:)[^@]+(@)", r"\1********\2", url)


def _cargar_env_local() -> None:
    """Carga variables desde .env y .env.local (ignorados por Git) si existen."""
    for fname in (".env", ".env.local"):
        for carpeta in (Path.cwd(), *Path(__file__).resolve().parents):
            archivo = carpeta / fname
            if archivo.is_file():
                for linea in archivo.read_text(encoding="utf-8").splitlines():
                    linea = linea.strip()
                    if linea and not linea.startswith("#") and "=" in linea:
                        clave, valor = linea.split("=", 1)
                        os.environ.setdefault(clave.strip(), valor.strip())
                break


def localizar_excel() -> Path:
    env_path = os.environ.get("EXCEL_DATA_PATH")
    candidatos = [
        Path(env_path) if env_path else None,
        BASE_DIR / "data (25).xlsx",
        BASE_DIR.parent / "data (25).xlsx",
        Path(r"c:\Users\edupa\Downloads\data (25).xlsx"),
    ]
    for p in candidatos:
        if p and p.is_file():
            return p
    raise SystemExit("No se encontró el archivo 'data (25).xlsx'. Define EXCEL_DATA_PATH o colócalo en Downloads.")


def limpiar_texto(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s != "" else None


def limpiar_entero(val) -> int | None:
    if val is None or str(val).strip() == "":
        return None
    return int(round(float(val)))


def limpiar_decimal(val) -> str | None:
    if val is None or str(val).strip() == "":
        return None
    num = float(val)
    return str(int(num)) if num.is_integer() else str(num)


def limpiar_hora(val) -> str | None:
    s = limpiar_texto(val)
    if not s:
        return None
    if len(s) == 5 and ":" in s:
        return f"{s}:00"
    if len(s) >= 8 and ":" in s:
        return s[:8]
    return s


def limpiar_clase(val) -> str | None:
    """Elimina siempre los dos primeros caracteres de CLASE (ej. 38A0102 -> A0102)."""
    s = limpiar_texto(val)
    if not s:
        return None
    return s[2:] if len(s) > 2 else s


def leer_y_limpiar_excel(excel_path: Path) -> list[dict]:
    print(f"1. Leyendo Excel '{excel_path.name}' (hoja 'Export')...")
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    if "Export" not in wb.sheetnames:
        raise SystemExit(f"La hoja 'Export' no existe en {excel_path}. Hojas: {wb.sheetnames}")

    ws = wb["Export"]
    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows_iter)]

    faltantes = [c for c in COLUMNAS_CONSERVADAS if c not in headers]
    if faltantes:
        raise SystemExit(f"Faltan columnas esperadas en hoja Export: {faltantes}")

    idx = {h: i for i, h in enumerate(headers)}
    registros: list[dict] = []
    descartadas = 0

    for row in rows_iter:
        cod_curso = limpiar_texto(row[idx["COD_CURSO"]])
        curso = limpiar_texto(row[idx["CURSO"]])
        if not cod_curso or not curso:
            descartadas += 1
            continue

        registros.append({
            "coordinador_curso": limpiar_texto(row[idx["COORDINADOR_CURSO"]]),
            "cod_docente": limpiar_texto(row[idx["COD_DOCENTE"]]),
            "nom_docente": limpiar_texto(row[idx["NOM_DOCENTE"]]),
            "cod_curso": cod_curso,
            "curso": curso,
            "catalogo": limpiar_texto(row[idx["CATALOGO"]]),
            "ciclo": limpiar_texto(row[idx["CICLO"]]),
            "seccion": limpiar_texto(row[idx["SECCION"]]),
            "carrera": limpiar_texto(row[idx["CARRERA"]]),
            "modalidad": limpiar_texto(row[idx["MODALIDAD"]]),
            "tipo_clase": limpiar_texto(row[idx["TIPO_CLASE"]]),
            "aforo": limpiar_entero(row[idx["AFORO"]]),
            "inscritos": limpiar_entero(row[idx["INSCRITOS"]]),
            "grado": limpiar_texto(row[idx["GRADO"]]),
            "dia_clase": limpiar_texto(row[idx["DIA_CLASE"]]),
            "hora_inicio": limpiar_hora(row[idx["HORA INICIO"]]),
            "hora_fin": limpiar_hora(row[idx["HORA FIN"]]),
            "horas_prog": limpiar_decimal(row[idx["HORAS_PROG"]]),
            "clase": limpiar_clase(row[idx["CLASE"]]),
            "tiempo_traslado_min": 15,
        })

    wb.close()
    print(f"   Registros válidos: {len(registros)} (filas pie de página/nulas descartadas: {descartadas})")
    return registros


def exportar_csv_respaldo(registros: list[dict]) -> None:
    CSV_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with CSV_OUTPUT.open("w", encoding="utf-8", newline="\n") as f:
        writer = csv.writer(f, delimiter=";", lineterminator="\n")
        writer.writerow(COLUMNAS_CONSERVADAS)
        for r in registros:
            writer.writerow([
                r["coordinador_curso"] or "",
                r["cod_docente"] or "",
                r["nom_docente"] or "",
                r["cod_curso"] or "",
                r["curso"] or "",
                r["catalogo"] or "",
                r["ciclo"] or "",
                r["seccion"] or "",
                r["carrera"] or "",
                r["modalidad"] or "",
                r["tipo_clase"] or "",
                "" if r["aforo"] is None else r["aforo"],
                "" if r["inscritos"] is None else r["inscritos"],
                r["grado"] or "",
                r["dia_clase"] or "",
                r["hora_inicio"] or "",
                r["hora_fin"] or "",
                r["horas_prog"] or "",
                r["clase"] or "",
            ])
    print(f"2. CSV de respaldo H2 generado en: {CSV_OUTPUT} ({len(registros)} filas)")


def neon_sql_http(http_url: str, conn_str: str, query: str, params: list | None = None) -> dict:
    payload = json.dumps({"query": query, "params": params or []}).encode("utf-8")
    req = urllib.request.Request(
        http_url,
        data=payload,
        headers={
            "Content-Type": "application/json; charset=UTF-8",
            "Neon-Connection-String": conn_str,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        body = re.sub(r"npg_[A-Za-z0-9]+", "********", body)
        raise SystemExit(f"Neon HTTP {err.code}: {body}")


def subir_a_neon_http(registros: list[dict], http_url: str, conn_str: str) -> None:
    print(f"3. Sincronizando {len(registros)} registros en Neon PostgreSQL ({enmascarar_credenciales(conn_str)})...")

    neon_sql_http(http_url, conn_str, "DROP TABLE IF EXISTS horarios_presenciales CASCADE;")
    neon_sql_http(
        http_url,
        conn_str,
        """
        CREATE TABLE horarios_presenciales (
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
        );
        """,
    )
    neon_sql_http(http_url, conn_str, "CREATE INDEX idx_hp_clase_dia ON horarios_presenciales (clase, dia_clase);")
    neon_sql_http(http_url, conn_str, "CREATE INDEX idx_hp_cod_curso ON horarios_presenciales (cod_curso);")

    cols_sql = ", ".join(COLUMNAS_SQL)
    ncols = len(COLUMNAS_SQL)
    batch_size = 250

    for start in range(0, len(registros), batch_size):
        chunk = registros[start : start + batch_size]
        placeholders = []
        params = []
        idx_p = 1
        for r in chunk:
            ph = ", ".join(f"${idx_p + i}" for i in range(ncols))
            placeholders.append(f"({ph})")
            params.extend([r[c] for c in COLUMNAS_SQL])
            idx_p += ncols
        sql = f"INSERT INTO horarios_presenciales ({cols_sql}) VALUES {', '.join(placeholders)};"
        neon_sql_http(http_url, conn_str, sql, params)
        if (start // batch_size) % 10 == 0 or start + batch_size >= len(registros):
            print(f"   Insertados {min(start + batch_size, len(registros))}/{len(registros)} registros...")

    conteo = neon_sql_http(http_url, conn_str, "SELECT COUNT(*)::int AS total FROM horarios_presenciales;")
    muestra = neon_sql_http(
        http_url,
        conn_str,
        """
        SELECT cod_curso, curso, aforo, inscritos, dia_clase, hora_inicio, hora_fin, clase
          FROM horarios_presenciales
         LIMIT 8;
        """,
    )
    print("4. Verificación en Neon PostgreSQL:")
    print("   Total filas:", conteo.get("rows"))
    print("   Muestra de registros (CLASE limpia):", muestra.get("rows"))


def main() -> None:
    _cargar_env_local()
    excel_path = localizar_excel()
    registros = leer_y_limpiar_excel(excel_path)
    exportar_csv_respaldo(registros)

    http_url = os.environ.get("NEON_HTTP_URL")
    conn_str = os.environ.get("NEON_CONNECTION_STRING")
    if http_url and conn_str and "********" not in conn_str and "***" not in conn_str:
        subir_a_neon_http(registros, http_url, conn_str)
    else:
        print("Aviso: NEON_HTTP_URL o NEON_CONNECTION_STRING no configurados en .env; solo se generó el CSV de respaldo H2.")


if __name__ == "__main__":
    main()
