import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HorarioService } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { Docente } from '../../models/docente.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

type EstadoCelda = 'libre' | 'ocupado' | 'nuevo';

const DIAS = [
  { clave: 'MONDAY', corto: 'Lun' },
  { clave: 'TUESDAY', corto: 'Mar' },
  { clave: 'WEDNESDAY', corto: 'Mié' },
  { clave: 'THURSDAY', corto: 'Jue' },
  { clave: 'FRIDAY', corto: 'Vie' },
  { clave: 'SATURDAY', corto: 'Sáb' }
];
const DIAS_JS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirmacion.component.html',
  styleUrl: './confirmacion.component.scss'
})
export class ConfirmacionComponent implements OnInit, OnDestroy {
  readonly dias = DIAS;
  readonly horas = Array.from({ length: 15 }, (_, i) => 7 + i); // 07:00 – 21:00

  reprogramacion: Reprogramacion | null = null;
  reprogramaciones: Reprogramacion[] = [];
  docente: Docente | null = null;
  horarios: Horario[] = [];
  puedeCrearNueva = false;

  private sub?: Subscription;

  constructor(
    private horarioService: HorarioService,
    private docenteService: DocenteService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const sesion = this.horarioService.getSesionActiva();
    if (!sesion) {
      this.router.navigate(['/login']);
      return;
    }
    this.puedeCrearNueva = sesion.rol !== 'Estudiante';

    this.sub = this.horarioService.ultimaReprogramacion$.subscribe(r => {
      if (r) {
        this.cargarDetalle(r);
      }
    });

    this.horarioService.listarTodasReprogramaciones()
      .pipe(catchError(() => of([] as Reprogramacion[])))
      .subscribe(lista => {
        this.reprogramaciones = lista;
        if (!this.reprogramacion && lista.length > 0) {
          this.cargarDetalle(lista[lista.length - 1]);
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get numeroSolicitud(): string {
    if (this.reprogramacion?.id) {
      return `#REP-2026-${String(this.reprogramacion.id).padStart(4, '0')}`;
    }
    return '#REP-2026-9812';
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
    this.cargarDetalle(r);
  }

  estadoCelda(dia: string, hora: number): EstadoCelda {
    const inicio = hora * 60;
    const fin = inicio + 60;
    const r = this.reprogramacion;
    if (r && this.diaReprogramacion === dia && this.solapa(r.horaInicio, r.horaFin, inicio, fin)) {
      return 'nuevo';
    }
    return this.horarios.some(h => h.dia === dia && this.solapa(h.horaInicio, h.horaFin, inicio, fin))
      ? 'ocupado'
      : 'libre';
  }

  hora(valor: string | undefined): string {
    return (valor ?? '').slice(0, 5);
  }

  etiquetaHora(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  imprimir(): void {
    window.print();
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
