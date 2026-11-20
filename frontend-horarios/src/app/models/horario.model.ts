export interface Horario {
  id?: number;
  docenteCodigo: string;
  curso: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  aula?: string;
}
