import random
import pandas as pd

ARCHIVO_ENTRADA = "data (25).xlsx"
ARCHIVO_SALIDA = "data_presencial_lista.xlsx"

NOMBRES = [
    "Carlos", "María", "José", "Ana", "Luis", "Lucía", "Jorge", "Elena",
    "Miguel", "Sofía", "Fernando", "Patricia", "Ricardo", "Valeria", "Diego",
    "Gabriela", "Alejandro", "Carmen", "Roberto", "Andrea", "Javier", "Rosa",
    "Daniel", "Claudia", "Héctor", "Mónica", "Raúl", "Silvia", "Óscar", "Paola"
]
APELLIDOS = [
    "Quispe", "Mamani", "Flores", "Rodríguez", "Gómez", "Fernández", "López",
    "Díaz", "Torres", "Ramírez", "Cruz", "Reyes", "Morales", "Gutiérrez",
    "Ortiz", "Chávez", "Ramos", "Castillo", "Mendoza", "Vargas", "Castro",
    "Romero", "Álvarez", "Ruiz", "Huamán", "Condori", "Paredes", "Salazar"
]

def a_minutos(hora_str):
    if pd.isna(hora_str):
        return None
    s = str(hora_str).strip()[:5]
    h, m = map(int, s.split(":"))
    return h * 60 + m

def generar_nombre_unico(usados):
    while True:
        nombre = f"{random.choice(APELLIDOS)} {random.choice(APELLIDOS)}, {random.choice(NOMBRES)} {random.choice(NOMBRES)}"
        if nombre not in usados:
            usados.add(nombre)
            return nombre

def main():
    random.seed(42)
    print("Leyendo Excel original...")
    df = pd.read_excel(ARCHIVO_ENTRADA, sheet_name="Export")

    # 1. Filtrar SOLO PRESENCIAL
    df = df[df["MODALIDAD"].astype(str).str.strip().str.upper() == "PRESENCIAL"].copy()

    # 2. Validar capacidad de salón (15 a 40 alumnos)
    df["AFORO"] = df["AFORO"].fillna(25).clip(lower=15, upper=40).astype(int)
    df["INSCRITOS"] = df["INSCRITOS"].fillna(15).clip(lower=15, upper=40).astype(int)
    df["INSCRITOS"] = df[["INSCRITOS", "AFORO"]].min(axis=1)

    df["_ini_min"] = df["HORA INICIO"].apply(a_minutos)
    df["_fin_min"] = df["HORA FIN"].apply(a_minutos)
    df["_grupo_seccion"] = df["NUM_CLASE"].fillna(-df.index.to_series())

    agenda_docente = {}
    catalogo_docentes = {}
    nombres_usados = set()
    asignacion_seccion = {}

    # 3. Agrupar por NUM_CLASE para asignar el mismo docente a toda la sección
    for seccion_id, grupo in df.groupby("_grupo_seccion", sort=False):
        sesiones = [
            (str(r["MODULO"]), str(r["DIA_CLASE"]), r["_ini_min"], r["_fin_min"], str(r["CLASE"]))
            for _, r in grupo.iterrows()
        ]

        docente_elegido = None
        for cod_doc, agenda in agenda_docente.items():
            compatible = True
            for mod, dia, ini, fin, _ in sesiones:
                if ini is None or fin is None:
                    continue
                for b_ini, b_fin, _ in agenda.get((mod, dia), []):
                    # Margen obligatorio de 15 minutos entre clases
                    if not (ini >= b_fin + 15 or fin + 15 <= b_ini):
                        compatible = False
                        break
                if not compatible:
                    break
            if compatible:
                docente_elegido = cod_doc
                break

        if docente_elegido is None:
            nuevo_num = len(catalogo_docentes) + 1
            docente_elegido = f"DOC{nuevo_num:04d}"
            catalogo_docentes[docente_elegido] = generar_nombre_unico(nombres_usados)
            agenda_docente[docente_elegido] = {}

        for mod, dia, ini, fin, salon in sesiones:
            if ini is not None and fin is not None:
                agenda_docente[docente_elegido].setdefault((mod, dia), []).append((ini, fin, salon))

        asignacion_seccion[seccion_id] = (docente_elegido, catalogo_docentes[docente_elegido])

    df["COD_DOCENTE"] = df["_grupo_seccion"].map(lambda s: asignacion_seccion[s][0])
    df["NOM_DOCENTE"] = df["_grupo_seccion"].map(lambda s: asignacion_seccion[s][1])

    df_limpio = df.drop(columns=["_ini_min", "_fin_min", "_grupo_seccion"])
    df_limpio.to_excel(ARCHIVO_SALIDA, index=False)
    print(f"Completado: '{ARCHIVO_SALIDA}' generado con {len(df_limpio)} filas y {len(catalogo_docentes)} docentes.")

if __name__ == "__main__":
    main()