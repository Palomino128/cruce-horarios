import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { HorarioPresencialService } from '../../services/horario-presencial.service';
import {
  AulaAforo,
  HorarioPresencial,
  ValidacionAsignacionResponse
} from '../../models/horario-presencial.model';
import { etiquetaCortaAula, obtenerInfoAula } from '../../utils/sedes-utp.util';

@Component({
  selector: 'app-base-presencial',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './base-presencial.component.html',
  styleUrl: './base-presencial.component.scss'
})
export class BasePresencialComponent implements OnInit {
  readonly dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

  registros: HorarioPresencial[] = [];
  aulasCatalogo: AulaAforo[] = [];

  totalRegistros = 0;
  totalAulas = 0;
  totalSobrecupo = 0;
  totalElements = 0;
  totalPages = 1;
  page = 0;
  size = 20;

  q = '';
  diaFiltro = '';
  claseFiltro = '';
  soloSobrecupo = false;

  cargando = false;
  error = '';

  // Validador interactivo de disponibilidad y capacidad (INSCRITOS <= AFORO)
  valClase = 'A0102';
  valDia = 'Lunes';
  valHoraInicio = '07:00';
  valHoraFin = '08:30';
  valInscritos = 20;
  validando = false;
  resultadoValidacion: ValidacionAsignacionResponse | null = null;

  constructor(
    private hpService: HorarioPresencialService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargando = true;
    forkJoin({
      pagina: this.hpService.listar({ page: 0, size: this.size }).pipe(catchError(() => of(null))),
      aulas: this.hpService.listarAulas().pipe(catchError(() => of([] as AulaAforo[])))
    }).subscribe(({ pagina, aulas }) => {
      this.cargando = false;
      this.aulasCatalogo = aulas;
      if (pagina) {
        this.aplicarPagina(pagina);
      } else {
        this.error = 'No se pudo cargar la base de horarios presenciales desde http://localhost:8082.';
      }
      this.cdr.markForCheck();
    });
  }

  buscar(resetPage = true): void {
    if (resetPage) {
      this.page = 0;
    }
    this.cargando = true;
    this.error = '';
    this.hpService.listar({
      q: this.q,
      dia: this.diaFiltro,
      clase: this.claseFiltro,
      soloSobrecupo: this.soloSobrecupo,
      page: this.page,
      size: this.size
    }).subscribe({
      next: pagina => {
        this.cargando = false;
        this.aplicarPagina(pagina);
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargando = false;
        this.error = 'Error al consultar la base de horarios presenciales.';
        this.cdr.markForCheck();
      }
    });
  }

  limpiarFiltros(): void {
    this.q = '';
    this.diaFiltro = '';
    this.claseFiltro = '';
    this.soloSobrecupo = false;
    this.buscar(true);
  }

  cambiarPagina(delta: number): void {
    const next = this.page + delta;
    if (next >= 0 && next < this.totalPages) {
      this.page = next;
      this.buscar(false);
    }
  }

  validarCapacidadYDisponibilidad(): void {
    if (!this.valClase.trim()) {
      return;
    }
    this.validando = true;
    this.resultadoValidacion = null;
    this.hpService.validarAsignacion({
      clase: this.valClase.trim().toUpperCase(),
      diaClase: this.valDia,
      horaInicio: this.valHoraInicio,
      horaFin: this.valHoraFin,
      inscritos: Number(this.valInscritos) || 0
    }).subscribe({
      next: res => {
        this.validando = false;
        this.resultadoValidacion = res;
        this.cdr.markForCheck();
      },
      error: () => {
        this.validando = false;
        this.cdr.markForCheck();
      }
    });
  }

  usarAulaSugerida(aula: AulaAforo): void {
    this.valClase = aula.clase;
    this.validarCapacidadYDisponibilidad();
  }

  cargarEnValidador(h: HorarioPresencial): void {
    this.valClase = h.clase || 'A0102';
    this.valDia = h.diaClase || 'Lunes';
    this.valHoraInicio = this.hora(h.horaInicio);
    this.valHoraFin = this.hora(h.horaFin);
    this.valInscritos = h.inscritos ?? 20;
    this.validarCapacidadYDisponibilidad();
  }

  porcentajeOcupacion(h: HorarioPresencial): number {
    if (!h.aforo || h.aforo <= 0 || h.inscritos == null) {
      return 0;
    }
    return Math.min(100, Math.round((h.inscritos * 100) / h.aforo));
  }

  tieneSobrecupo(h: HorarioPresencial): boolean {
    return h.inscritos != null && h.aforo != null && h.inscritos > h.aforo;
  }

  ubicacionAula(clase?: string | null): string {
    return etiquetaCortaAula(clase);
  }

  esSubterranea(clase?: string | null): boolean {
    return obtenerInfoAula(clase).esSubterranea;
  }

  hora(val?: string | null): string {
    return (val ?? '').slice(0, 5);
  }

  private aplicarPagina(pagina: {
    content: HorarioPresencial[];
    totalElements: number;
    totalPages: number;
    page: number;
    totalRegistros: number;
    totalSobrecupo: number;
    totalAulas: number;
  }): void {
    this.registros = pagina.content;
    this.totalElements = pagina.totalElements;
    this.totalPages = Math.max(1, pagina.totalPages);
    this.page = pagina.page;
    this.totalRegistros = pagina.totalRegistros;
    this.totalSobrecupo = pagina.totalSobrecupo;
    this.totalAulas = pagina.totalAulas;
  }
}
