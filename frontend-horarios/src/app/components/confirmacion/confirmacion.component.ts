import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HorarioService } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { Docente } from '../../models/docente.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

type EstadoCelda = 'libre' | 'ocupado' | 'nuevo' | 'cerrado';

interface BloqueAcademico {
  inicio: string;
  fin: string;
  etiqueta: string;
}

const DIAS = [
  { clave: 'MONDAY', corto: 'Lun' },
  { clave: 'TUESDAY', corto: 'Mar' },
  { clave: 'WEDNESDAY', corto: 'Mié' },
  { clave: 'THURSDAY', corto: 'Jue' },
  { clave: 'FRIDAY', corto: 'Vie' },
  { clave: 'SATURDAY', corto: 'Sáb' },
  { clave: 'SUNDAY', corto: 'Dom' }
];
const DIAS_JS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const BLOQUES_ACADEMICOS: BloqueAcademico[] = [
  { inicio: '07:00', fin: '08:30', etiqueta: '07:00 – 08:30' },
  { inicio: '08:45', fin: '10:15', etiqueta: '08:45 – 10:15' },
  { inicio: '10:30', fin: '12:00', etiqueta: '10:30 – 12:00' },
  { inicio: '12:15', fin: '13:45', etiqueta: '12:15 – 13:45' },
  { inicio: '14:00', fin: '15:30', etiqueta: '14:00 – 15:30' },
  { inicio: '15:45', fin: '17:15', etiqueta: '15:45 – 17:15' },
  { inicio: '17:30', fin: '19:00', etiqueta: '17:30 – 19:00' },
  { inicio: '19:15', fin: '20:45', etiqueta: '19:15 – 20:45' },
  { inicio: '21:00', fin: '22:30', etiqueta: '21:00 – 22:30' }
];

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './confirmacion.component.html',
  styleUrl: './confirmacion.component.scss'
})
export class ConfirmacionComponent implements OnInit, OnDestroy {
  readonly dias = DIAS;
  readonly bloques = BLOQUES_ACADEMICOS;

  reprogramacion: Reprogramacion | null = null;
  reprogramaciones: Reprogramacion[] = [];
  docente: Docente | null = null;
  horarios: Horario[] = [];
  puedeCrearNueva = false;
  esCoordinador = false;

  observacionInput = '';
  cargando = true;
  procesando = false;
  mensajeAccion = '';
  errorAccion = '';

  private sub?: Subscription;

  constructor(
    private horarioService: HorarioService,
    private docenteService: DocenteService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const sesion = this.horarioService.getSesionActiva();
    if (!sesion) {
      this.router.navigate(['/login']);
      return;
    }
    this.puedeCrearNueva = sesion.rol !== 'Estudiante';
    this.esCoordinador = sesion.rol === 'Coordinador Académico';

    this.sub = this.horarioService.ultimaReprogramacion$.subscribe(r => {
      if (r) {
        this.cargarDetalle(r);
      }
    });

    this.cargarListaReprogramaciones();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  cargarListaReprogramaciones(): void {
    this.cargando = true;
    this.horarioService.listarTodasReprogramaciones()
      .pipe(catchError(() => of([] as Reprogramacion[])))
      .subscribe(lista => {
        this.reprogramaciones = lista;
        this.cargando = false;
        if (this.reprogramacion && !this.reprogramacion.id) {
          const match = [...lista].reverse().find(
            item =>
              item.docenteCodigo === this.reprogramacion?.docenteCodigo &&
              item.curso === this.reprogramacion?.curso &&
              item.fecha === this.reprogramacion?.fecha &&
              item.horaInicio?.slice(0, 5) === this.reprogramacion?.horaInicio?.slice(0, 5)
          );
          if (match) {
            this.cargarDetalle(match);
          }
        } else if (!this.reprogramacion && lista.length > 0) {
          this.cargarDetalle(lista[lista.length - 1]);
        }
        this.cdr.markForCheck();
      });
  }

  get numeroSolicitud(): string {
    if (this.reprogramacion?.id) {
      return `#REP-2026-${String(this.reprogramacion.id).padStart(4, '0')}`;
    }
    return '#REP-2026-PEND';
  }

  get estaConfirmada(): boolean {
    return this.reprogramacion?.estado === 'CONFIRMADO';
  }

  get estaRechazada(): boolean {
    return this.reprogramacion?.estado === 'RECHAZADO';
  }

  get estaPendiente(): boolean {
    return Boolean(this.reprogramacion?.id) && !this.estaConfirmada && !this.estaRechazada;
  }

  get etiquetaEstado(): string {
    if (this.estaConfirmada) return 'CONFIRMADO';
    if (this.estaRechazada) return 'RECHAZADO';
    return 'SOLICITADO';
  }

  get diaReprogramacion(): string | null {
    if (!this.reprogramacion?.fecha) {
      return null;
    }
    const [y, m, d] = this.reprogramacion.fecha.split('-').map(Number);
    return DIAS_JS[new Date(y, m - 1, d).getDay()];
  }

  get fechaFormateada(): string {
    const [y, m, d] = (this.reprogramacion?.fecha ?? '').split('-');
    return y && m && d ? `${d}/${m}/${y}` : '';
  }

  seleccionarReprogramacion(r: Reprogramacion): void {
    this.mensajeAccion = '';
    this.errorAccion = '';
    this.observacionInput = r.observacionCoordinador ?? '';
    this.cargarDetalle(r);
  }

  confirmarEnServidor(): void {
    if (!this.reprogramacion?.id || this.estaConfirmada || this.procesando) {
      return;
    }
    this.procesando = true;
    this.mensajeAccion = '';
    this.errorAccion = '';
    this.horarioService.confirmarReprogramacion(this.reprogramacion.id, this.observacionInput.trim()).subscribe({
      next: actualizada => {
        this.procesando = false;
        this.reprogramacion = actualizada;
        this.reprogramaciones = this.reprogramaciones.map(item =>
          item.id === actualizada.id ? actualizada : item
        );
        this.mensajeAccion = `Solicitud ${this.numeroSolicitud} confirmada oficialmente y sincronizada.`;
        this.cdr.markForCheck();
      },
      error: () => {
        this.procesando = false;
        this.errorAccion = 'No se pudo confirmar la solicitud en el servidor (http://localhost:8082).';
        this.cdr.markForCheck();
      }
    });
  }

  rechazarEnServidor(): void {
    if (!this.reprogramacion?.id || this.estaRechazada || this.procesando) {
      return;
    }
    const obs = this.observacionInput.trim() || 'Reprogramación observada por Coordinación de Ingeniería.';
    this.procesando = true;
    this.mensajeAccion = '';
    this.errorAccion = '';
    this.horarioService.rechazarReprogramacion(this.reprogramacion.id, obs).subscribe({
      next: actualizada => {
        this.procesando = false;
        this.reprogramacion = actualizada;
        this.reprogramaciones = this.reprogramaciones.map(item =>
          item.id === actualizada.id ? actualizada : item
        );
        this.mensajeAccion = `Solicitud ${this.numeroSolicitud} marcada como RECHAZADO.`;
        this.cdr.markForCheck();
      },
      error: () => {
        this.procesando = false;
        this.errorAccion = 'No se pudo rechazar la solicitud en el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  exportarCsv(): void {
    if (!this.reprogramacion) {
      return;
    }
    const r = this.reprogramacion;
    const docenteNombre = this.docente ? `${this.docente.nombres} ${this.docente.apellidos}` : r.docenteCodigo;
    const filas = [
      ['Solicitud', 'Docente Codigo', 'Docente Nombre', 'Curso', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Salon', 'Motivo', 'Asistencia (%)', 'Estado', 'Observacion Coordinador'],
      [
        this.numeroSolicitud,
        r.docenteCodigo,
        docenteNombre,
        r.curso,
        r.fecha,
        this.hora(r.horaInicio),
        this.hora(r.horaFin),
        r.aula || 'Por asignar',
        r.motivo || 'Recuperación programada',
        r.porcentajeAsistencia ?? 100,
        this.etiquetaEstado,
        r.observacionCoordinador || ''
      ]
    ];
    const csv = filas.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `constancia_${this.numeroSolicitud.replace('#', '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.mensajeAccion = `Constancia ${this.numeroSolicitud} exportada en formato CSV.`;
  }

  estadoCelda(dia: string, bloque: BloqueAcademico): EstadoCelda {
    if (dia === 'SUNDAY' && this.aMinutos(bloque.fin) > 14 * 60) {
      return 'cerrado';
    }
    const inicio = this.aMinutos(bloque.inicio);
    const fin = this.aMinutos(bloque.fin);
    const r = this.reprogramacion;
    if (r && !this.estaRechazada && this.diaReprogramacion === dia && this.solapa(r.horaInicio, r.horaFin, inicio, fin)) {
      return 'nuevo';
    }
    return this.horarios.some(h => h.dia === dia && this.solapa(h.horaInicio, h.horaFin, inicio, fin))
      ? 'ocupado'
      : 'libre';
  }

  hora(valor: string | undefined): string {
    return (valor ?? '').slice(0, 5);
  }

  imprimir(): void {
    window.print();
  }

  regresar(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/registro-reprogramacion']);
    }
  }

  nuevaReprogramacion(): void {
    this.router.navigate(['/registro-reprogramacion']);
  }

  aceptar(): void {
    this.horarioService.setUltimaReprogramacion(null);
    this.router.navigate(['/consulta-horario']);
  }

  private cargarDetalle(r: Reprogramacion): void {
    this.reprogramacion = r;
    this.docente = null;
    this.horarios = [];
    this.observacionInput = r.observacionCoordinador ?? '';
    if (r?.docenteCodigo) {
      forkJoin({
        horarios: this.horarioService.horariosDocente(r.docenteCodigo).pipe(catchError(() => of([] as Horario[]))),
        docente: this.docenteService.buscarPorCodigo(r.docenteCodigo).pipe(catchError(() => of(null)))
      }).subscribe(({ horarios, docente }) => {
        this.horarios = horarios;
        this.docente = docente;
        this.cdr.markForCheck();
      });
    }
    this.cdr.markForCheck();
  }

  private solapa(hi: string, hf: string, inicio: number, fin: number): boolean {
    const a = this.aMinutos(hi);
    const b = this.aMinutos(hf);
    return a < fin && b > inicio;
  }

  private aMinutos(hhmm: string): number {
    const [h, m] = (hhmm ?? '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
}
