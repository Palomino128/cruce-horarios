export interface Reprogramacion {
  id?: number;
  docenteCodigo: string;
  curso: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aula?: string;
  estado?: string;
}
