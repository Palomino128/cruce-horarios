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

export interface OpcionRecuperacion {
  fecha: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  aulaSugerida: string;
  porcentajeAsistencia: number;
  recomendada: boolean;
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

export interface BorradorReprogramacion {
  docenteCodigo: string;
  curso: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aula?: string;
  motivo?: string;
  sedeFiltro?: string;
  salonFiltro?: string;
}

export interface EstadoConsultaGuardado {
  tipo: 'docente' | 'estudiante';
  codigo: string;
}

@Injectable({ providedIn: 'root' })
export class HorarioService {
  private static readonly STORAGE_KEY = 'sesion_horarios_utp';
  private readonly api = 'http://localhost:8082/api/horarios';
  private readonly authApi = 'http://localhost:8082/api/auth';

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

  private readonly borradorReprogramacionSubject = new BehaviorSubject<BorradorReprogramacion | null>(null);
  private readonly estadoConsultaSubject = new BehaviorSubject<EstadoConsultaGuardado | null>(null);
  private rolPreseleccionadoLogin: RolUsuario | null = null;

  constructor(private http: HttpClient) {
    const sesionGuardada = this.leerSesionStorage();
    if (sesionGuardada) {
      this.sesionActivaSubject.next(sesionGuardada);
      this.rolActivoSubject.next(sesionGuardada.rol);
    }
  }

  login(rol: RolUsuario, codigo: string, password: string): Observable<SesionUsuario> {
    return this.http.post<SesionUsuario>(`${this.authApi}/login`, { rol, codigo, password });
  }

  setRolActivo(rol: RolUsuario): void {
    this.rolActivoSubject.next(rol);
  }

  setRolPreseleccionadoLogin(rol: RolUsuario | null): void {
    this.rolPreseleccionadoLogin = rol;
  }

  consumirRolPreseleccionadoLogin(): RolUsuario | null {
    const rol = this.rolPreseleccionadoLogin;
    this.rolPreseleccionadoLogin = null;
    return rol;
  }

  setBorradorReprogramacion(borrador: BorradorReprogramacion | null): void {
    this.borradorReprogramacionSubject.next(borrador ? { ...borrador } : null);
  }

  getBorradorReprogramacion(): BorradorReprogramacion | null {
    const v = this.borradorReprogramacionSubject.getValue();
    return v ? { ...v } : null;
  }

  setEstadoConsulta(estado: EstadoConsultaGuardado | null): void {
    this.estadoConsultaSubject.next(estado ? { ...estado } : null);
  }

  getEstadoConsulta(): EstadoConsultaGuardado | null {
    const v = this.estadoConsultaSubject.getValue();
    return v ? { ...v } : null;
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
    this.borradorReprogramacionSubject.next(null);
    this.estadoConsultaSubject.next(null);
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

  confirmarReprogramacion(id: number, observacion?: string): Observable<Reprogramacion> {
    return this.http.put<Reprogramacion>(`${this.api}/reprogramaciones/${id}/confirmar`, {
      observacion: observacion ?? ''
    });
  }

  rechazarReprogramacion(id: number, observacion: string): Observable<Reprogramacion> {
    return this.http.put<Reprogramacion>(`${this.api}/reprogramaciones/${id}/rechazar`, { observacion });
  }

  eliminarReprogramacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/reprogramaciones/${id}`);
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

  recomendarOpcionesRecuperacion(docenteCodigo: string, curso: string): Observable<OpcionRecuperacion[]> {
    const d = encodeURIComponent(docenteCodigo.trim().toUpperCase());
    const c = encodeURIComponent(curso.trim());
    return this.http.get<OpcionRecuperacion[]>(`${this.api}/recomendaciones?docenteCodigo=${d}&curso=${c}`);
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
