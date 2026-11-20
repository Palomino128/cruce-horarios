export type ClaveSede = 'TODAS' | 'TACNA_ARICA' | 'PARRA_1' | 'PARRA_2';

export interface InfoSede {
  clave: Exclude<ClaveSede, 'TODAS'>;
  nombre: string;
  pabellones: string;
  subterraneaDetalle: string;
  maxSotano: number;
}

export interface InfoAula {
  codigo: string;
  pabellon: string;
  sede: string;
  claveSede: Exclude<ClaveSede, 'TODAS'> | null;
  pisoEtiqueta: string;
  esSubterranea: boolean;
  valida: boolean;
}

export const SEDES_UTP: InfoSede[] = [
  {
    clave: 'TACNA_ARICA',
    nombre: 'Sede Tacna y Arica',
    pabellones: 'A – B',
    subterraneaDetalle: 'Sótano -1 (ej. AS101, BS102)',
    maxSotano: 1
  },
  {
    clave: 'PARRA_1',
    nombre: 'Sede Parra 1',
    pabellones: 'C – G',
    subterraneaDetalle: 'Sótano -1 y -2 (ej. CS101, DS201)',
    maxSotano: 2
  },
  {
    clave: 'PARRA_2',
    nombre: 'Sede Parra 2',
    pabellones: 'H – I',
    subterraneaDetalle: 'Sótano -1 y -2 (ej. HS101, IS202)',
    maxSotano: 2
  }
];

export const SALONES_PRINCIPALES_UTP: string[] = [
  'A101', 'AS101', 'A205', 'B108', 'BS102', 'B204',
  'C302', 'CS101', 'D105', 'DS201', 'E201', 'F305',
  'G102', 'H203', 'HS101', 'HS201', 'I301', 'IS202'
];

export const REGEX_AULA_UTP = /^([AB](S1\d{2}|[1-9]\d{2})|[C-G](S[12]\d{2}|[1-9]\d{2})|[HI](S[12]\d{2}|[1-9]\d{2}))$/i;

const RE_TACNA = /^[AB](S1\d{2}|[1-9]\d{2})$/;
const RE_PARRA_1 = /^[C-G](S[12]\d{2}|[1-9]\d{2})$/;
const RE_PARRA_2 = /^[HI](S[12]\d{2}|[1-9]\d{2})$/;

export function validarAulaUtp(aula?: string | null, obligatorio = false): string {
  const clean = (aula ?? '').trim().toUpperCase();
  if (!clean) {
    return obligatorio ? 'Ingrese el código del aula (ej. A101, AS101, CS201, HS201).' : '';
  }

  const pab = clean[0];
  if (pab === 'A' || pab === 'B') {
    if (RE_TACNA.test(clean)) return '';
    if (/^[AB]S[2-9]\d{2}$/.test(clean)) {
      return `Aula inválida (${clean}): en Sede Tacna y Arica (pabellones A y B) las aulas subterráneas solo llegan al piso -1 (ej. AS101, BS102).`;
    }
    return `Formato inválido (${clean}) para Sede Tacna y Arica: use A/B + piso (ej. A101) o S1xx para sótano -1 (ej. AS101).`;
  }

  if (pab >= 'C' && pab <= 'G') {
    if (RE_PARRA_1.test(clean)) return '';
    if (/^[C-G]S[3-9]\d{2}$/.test(clean)) {
      return `Aula inválida (${clean}): en Sede Parra 1 (pabellones C–G) las aulas subterráneas solo llegan hasta el piso -2 (ej. CS101, DS201).`;
    }
    return `Formato inválido (${clean}) para Sede Parra 1: use C–G + piso (ej. C302) o S1xx/S2xx para sótano -1/-2 (ej. DS201).`;
  }

  if (pab === 'H' || pab === 'I') {
    if (RE_PARRA_2.test(clean)) return '';
    if (/^[HI]S[3-9]\d{2}$/.test(clean)) {
      return `Aula inválida (${clean}): en Sede Parra 2 (pabellones H–I) las aulas subterráneas solo llegan hasta el piso -2 (ej. HS101, IS202).`;
    }
    return `Formato inválido (${clean}) para Sede Parra 2: use H–I + piso (ej. H203) o S1xx/S2xx para sótano -1/-2 (ej. HS201).`;
  }

  return `Pabellón no válido (${clean}). Las 3 sedes UTP son: Sede Tacna y Arica (A–B, sótano -1: AS101), Sede Parra 1 (C–G, sótano -1/-2: CS101, DS201) y Sede Parra 2 (H–I, sótano -1/-2: HS101, IS202).`;
}

export function obtenerInfoAula(aula?: string | null): InfoAula {
  const clean = (aula ?? '').trim().toUpperCase();
  if (!clean) {
    return {
      codigo: '',
      pabellon: '',
      sede: 'Por asignar',
      claveSede: null,
      pisoEtiqueta: '',
      esSubterranea: false,
      valida: false
    };
  }

  const pab = clean[0];
  let sede = 'Sede no reconocida';
  let claveSede: Exclude<ClaveSede, 'TODAS'> | null = null;

  if (pab === 'A' || pab === 'B') {
    sede = 'Sede Tacna y Arica';
    claveSede = 'TACNA_ARICA';
  } else if (pab >= 'C' && pab <= 'G') {
    sede = 'Sede Parra 1';
    claveSede = 'PARRA_1';
  } else if (pab === 'H' || pab === 'I') {
    sede = 'Sede Parra 2';
    claveSede = 'PARRA_2';
  }

  const esSub = clean.length >= 3 && clean[1] === 'S' && /\d/.test(clean[2]);
  let pisoEtiqueta = '';
  if (esSub) {
    pisoEtiqueta = `Sótano -${clean[2]}`;
  } else if (clean.length >= 2 && /[1-9]/.test(clean[1])) {
    pisoEtiqueta = `Piso ${clean[1]}`;
  }

  return {
    codigo: clean,
    pabellon: pab,
    sede,
    claveSede,
    pisoEtiqueta,
    esSubterranea: esSub,
    valida: REGEX_AULA_UTP.test(clean)
  };
}

export function etiquetaUbicacionAula(aula?: string | null): string {
  const info = obtenerInfoAula(aula);
  if (!info.codigo) return 'Por asignar';
  return info.pisoEtiqueta ? `${info.sede} · ${info.pisoEtiqueta}` : info.sede;
}

export function etiquetaCortaAula(aula?: string | null): string {
  const info = obtenerInfoAula(aula);
  if (!info.codigo) return 'Por asignar';
  const sedeCorta =
    info.claveSede === 'TACNA_ARICA' ? 'Tacna y Arica'
      : info.claveSede === 'PARRA_1' ? 'Parra 1'
        : info.claveSede === 'PARRA_2' ? 'Parra 2'
          : info.sede;
  return info.pisoEtiqueta ? `${sedeCorta} · ${info.pisoEtiqueta}` : sedeCorta;
}

export function perteneceASede(aula?: string | null, sede: ClaveSede = 'TODAS'): boolean {
  if (sede === 'TODAS') return true;
  return obtenerInfoAula(aula).claveSede === sede;
}
