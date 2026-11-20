import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Horario } from '../models/horario.model';
import { Reprogramacion } from '../models/reprogramacion.model';

export interface DisponibilidadPresencial {
  totalEstudiantes: number;
  disponibles: number;
  conCruce: number;
  porcentajeAsistencia: number;
  estudiantesConCruce: string[];
}

export interface ConfirmacionReprogramacion {
  solicitudNumero: string;
  estado: string;
  mensaje: string;
  docenteNombre?: string;
  reprogramacion: Reprogramacion;
  fechaRegistro: string;
  disponibilidadPresencial?: DisponibilidadPresencial | null;
}

export interface Matricula {
  id?: number;
  estudianteCodigo: string;
  curso: string;
}

export type RolUsuario = 'Coordinador Académico' | 'Docente' | 'Estudiante';

export interface SesionUsuario {
  rol: RolUsuario;
  codigo: string;
  nombres: string;
  apellidos: string;
}

export interface CursoPreseleccionado {
  docenteCodigo: string;
  curso: string;
}

@Injectable({ providedIn: 'root' })
export class HorarioService {
  private static readonly STORAGE_KEY = 'sesion_horarios_utp';
  private readonly api = 'http://localhost:8082/api/horarios';

  /** Última reprogramación aprobada (HTTP 200), compartida con ConfirmacionComponent. */
  private readonly ultimaReprogramacionSubject = new BehaviorSubject<Reprogramacion | null>(null);
  readonly ultimaReprogramacion$ = this.ultimaReprogramacionSubject.asObservable();

  private readonly ultimaConfirmacionSubject = new BehaviorSubject<ConfirmacionReprogramacion | null>(null);
  readonly ultimaConfirmacion$ = this.ultimaConfirmacionSubject.asObservable();

  private readonly rolActivoSubject = new BehaviorSubject<RolUsuario>('Coordinador Académico');
  readonly rolActivo$ = this.rolActivoSubject.asObservable();

  private readonly sesionActivaSubject = new BehaviorSubject<SesionUsuario | null>(null);
  readonly sesionActiva$ = this.sesionActivaSubject.asObservable();

  private readonly cursoPreseleccionadoSubject = new BehaviorSubject<CursoPreseleccionado | null>(null);
  readonly cursoPreseleccionado$ = this.cursoPreseleccionadoSubject.asObservable();

  constructor(private http: HttpClient) {
    const sesionGuardada = this.leerSesionStorage();
    if (sesionGuardada) {
      this.sesionActivaSubject.next(sesionGuardada);
      this.rolActivoSubject.next(sesionGuardada.rol);
    }
  }

  setRolActivo(rol: RolUsuario): void {
    this.rolActivoSubject.next(rol);
  }

  setSesionActiva(sesion: SesionUsuario | null): void {
    this.sesionActivaSubject.next(sesion);
    if (sesion) {
      this.rolActivoSubject.next(sesion.rol);
      this.guardarSesionStorage(sesion);
    } else {
      this.eliminarSesionStorage();
    }
  }

  getSesionActiva(): SesionUsuario | null {
    return this.sesionActivaSubject.getValue();
  }

  cerrarSesion(): void {
    this.sesionActivaSubject.next(null);
    this.rolActivoSubject.next('Coordinador Académico');
    this.cursoPreseleccionadoSubject.next(null);
    this.eliminarSesionStorage();
  }

  setCursoPreseleccionado(curso: CursoPreseleccionado | null): void {
    this.cursoPreseleccionadoSubject.next(curso);
  }

  consumirCursoPreseleccionado(): CursoPreseleccionado | null {
    const val = this.cursoPreseleccionadoSubject.getValue();
    this.cursoPreseleccionadoSubject.next(null);
    return val;
  }

  private leerSesionStorage(): SesionUsuario | null {
    try {
      const raw = typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(HorarioService.STORAGE_KEY)
        : null;
      return raw ? (JSON.parse(raw) as SesionUsuario) : null;
    } catch {
      return null;
    }
  }

  private guardarSesionStorage(sesion: SesionUsuario): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(HorarioService.STORAGE_KEY, JSON.stringify(sesion));
      }
    } catch {
      // Ignora restricciones del almacenamiento del navegador
    }
  }

  private eliminarSesionStorage(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(HorarioService.STORAGE_KEY);
      }
    } catch {
      // Ignora restricciones del almacenamiento del navegador
    }
  }

  horariosDocente(codigo: string): Observable<Horario[]> {
    return this.http.get<Horario[]>(`${this.api}/${encodeURIComponent(codigo)}`);
  }

  listarTodos(): Observable<Horario[]> {
    return this.http.get<Horario[]>(this.api);
  }

  horariosEstudiante(codigo: string): Observable<Horario[]> {
    return this.http.get<Horario[]>(`${this.api}/estudiantes/${encodeURIComponent(codigo)}`);
  }

  reprogramacionesDocente(codigo: string): Observable<Reprogramacion[]> {
    return this.http.get<Reprogramacion[]>(`${this.api}/reprogramaciones/${encodeURIComponent(codigo)}`);
  }

  reprogramacionesEstudiante(codigo: string): Observable<Reprogramacion[]> {
    return this.http.get<Reprogramacion[]>(`${this.api}/reprogramaciones/estudiantes/${encodeURIComponent(codigo)}`);
  }

  listarTodasReprogramaciones(): Observable<Reprogramacion[]> {
    return this.http.get<Reprogramacion[]>(`${this.api}/reprogramaciones`);
  }

  confirmarReprogramacion(id: number): Observable<Reprogramacion> {
    return this.http.put<Reprogramacion>(`${this.api}/reprogramaciones/${id}/confirmar`, {});
  }

  registrarHorarioRegular(h: Horario): Observable<Horario> {
    return this.http.post<Horario>(this.api, h);
  }

  listarMatriculas(): Observable<Matricula[]> {
    return this.http.get<Matricula[]>(`${this.api}/matriculas`);
  }

  registrarMatricula(estudianteCodigo: string, curso: string): Observable<Matricula> {
    return this.http.post<Matricula>(`${this.api}/matriculas`, { estudianteCodigo, curso });
  }

  reprogramar(r: Reprogramacion): Observable<string> {
    return this.http.post(`${this.api}/reprogramaciones`, r, { responseType: 'text' });
  }

  consultarDisponibilidadPresencial(r: Reprogramacion): Observable<DisponibilidadPresencial> {
    return this.http.post<DisponibilidadPresencial>(`${this.api}/disponibilidad-presencial`, r);
  }

  setUltimaReprogramacion(r: Reprogramacion | null): void {
    this.ultimaReprogramacionSubject.next(r);
  }

  getUltimaReprogramacion(): Reprogramacion | null {
    return this.ultimaReprogramacionSubject.getValue();
  }

  setUltimaConfirmacion(confirmacion: ConfirmacionReprogramacion): void {
    this.ultimaConfirmacionSubject.next(confirmacion);
  }

  getUltimaConfirmacion(): ConfirmacionReprogramacion | null {
    return this.ultimaConfirmacionSubject.getValue();
  }
}
