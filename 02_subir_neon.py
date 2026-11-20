import pandas as pd
from sqlalchemy import create_engine, text

import os
import re
from pathlib import Path


def enmascarar_credenciales(url: str) -> str:
    """Oculta la contraseña en cualquier URL PostgreSQL mostrándola como ********."""
    if not url:
        return ""
    return re.sub(r"(://[^:/@]+:)[^@]+(@)", r"\1********\2", url)


def _cargar_env_local():
    """Carga variables desde el archivo .env (ignorado por Git) si existe."""
    for carpeta in (Path.cwd(), *Path(__file__).resolve().parents):
        archivo = carpeta / ".env"
        if archivo.is_file():
            for linea in archivo.read_text(encoding="utf-8").splitlines():
                linea = linea.strip()
                if linea and not linea.startswith("#") and "=" in linea:
                    clave, valor = linea.split("=", 1)
                    os.environ.setdefault(clave.strip(), valor.strip())
            break


_cargar_env_local()

# Conexión directa a Neon (sin -pooler para carga masiva estable), leída de NEON_DIRECT_URL
DATABASE_URL = os.environ.get("NEON_DIRECT_URL")
if not DATABASE_URL or "********" in DATABASE_URL or "***" in DATABASE_URL:
    raise SystemExit("Define NEON_DIRECT_URL con tu clave real en el archivo .env (ver .env.example).")
ARCHIVO_LIMPIO = "data_presencial_lista.xlsx"

def main():
    print(f"0. Destino configurado: {enmascarar_credenciales(DATABASE_URL)}")
    print("1. Leyendo Excel limpio...")
    df = pd.read_excel(ARCHIVO_LIMPIO)

    engine = create_engine(DATABASE_URL)

    print("2. Limpiando tablas de destino en Neon...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE horarios_presenciales, docentes_presenciales RESTART IDENTITY CASCADE;"))

    # 3. Subir catálogo a docentes_presenciales
    df_docentes = df[["COD_DOCENTE", "NOM_DOCENTE"]].drop_duplicates().rename(
        columns={"COD_DOCENTE": "cod_docente", "NOM_DOCENTE": "nom_docente"}
    )
    print(f"3. Subiendo {len(df_docentes)} docentes a 'docentes_presenciales'...")
    df_docentes.to_sql("docentes_presenciales", engine, if_exists="append", index=False, method="multi", chunksize=500)

    # 4. Subir horarios a horarios_presenciales
    df_sql = df.rename(columns={
        "COORDINADOR_CURSO": "coordinador_curso",
        "COD_DOCENTE": "cod_docente",
        "NOM_DOCENTE": "nom_docente",
        "COD_CURSO": "cod_curso",
        "CURSO": "curso",
        "CATALOGO": "catalogo",
        "CICLO": "ciclo",
        "SECCION": "seccion",
        "NUM_CLASE": "num_clase",
        "CARRERA": "carrera",
        "MODALIDAD": "modalidad",
        "TIPO_CLASE": "tipo_clase",
        "AFORO": "aforo",
        "INSCRITOS": "inscritos",
        "GRADO": "grado",
        "MODULO": "modulo",
        "DIA_CLASE": "dia_clase",
        "HORA INICIO": "hora_inicio",
        "HORA FIN": "hora_fin",
        "HORAS_PROG": "horas_prog",
        "CATEGORIA": "categoria",
        "EDIFICIO": "edificio",
        "CLASE": "clase"
    })
    df_sql["tiempo_traslado_min"] = 15
    df_sql["cod_curso"] = df_sql["cod_curso"].astype(str)
    df_sql["seccion"] = df_sql["seccion"].astype(str)
    df_sql["hora_inicio"] = pd.to_datetime(df_sql["hora_inicio"].astype(str), format="mixed").dt.time
    df_sql["hora_fin"] = pd.to_datetime(df_sql["hora_fin"].astype(str), format="mixed").dt.time

    print(f"4. Subiendo {len(df_sql)} registros a 'horarios_presenciales'...")
    df_sql.to_sql("horarios_presenciales", engine, if_exists="append", index=False, method="multi", chunksize=500)
    print("¡Carga completada con éxito en Neon!")

if __name__ == "__main__":
    main()
