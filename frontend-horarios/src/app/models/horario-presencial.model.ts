export interface HorarioPresencial {
  id?: number;
  coordinadorCurso: string | null;
  codDocente: string | null;
  nomDocente: string | null;
  codCurso: string;
  curso: string;
  catalogo: string | null;
  ciclo: string | null;
  seccion: string | null;
  carrera: string | null;
  modalidad: string | null;
  tipoClase: string | null;
  aforo: number | null;
  inscritos: number | null;
  grado: string | null;
  diaClase: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  horasProg: number | null;
  clase: string | null;
  tiempoTrasladoMin?: number | null;
}

export interface HorarioPresencialPage {
  content: HorarioPresencial[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  totalRegistros: number;
  totalSobrecupo: number;
  totalAulas: number;
}

export interface AulaAforo {
  clase: string;
  aforo: number | null;
}

export interface ValidacionAsignacionRequest {
  clase: string;
  diaClase: string;
  horaInicio: string;
  horaFin: string;
  inscritos: number;
}

export interface ConflictoAula {
  codCurso: string;
  curso: string;
  seccion: string;
  diaClase: string;
  horaInicio: string;
  horaFin: string;
  inscritos: number | null;
  aforo: number | null;
}

export interface ValidacionAsignacionResponse {
  valido: boolean;
  aulaDisponible: boolean;
  capacidadSuficiente: boolean;
  clase: string;
  aforoAula: number | null;
  inscritosSolicitados: number | null;
  mensaje: string;
  conflictos: ConflictoAula[];
  aulasSugeridas: AulaAforo[];
}
