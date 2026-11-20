import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HorarioService } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { Docente } from '../../models/docente.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

type EstadoEnvio = 'idle' | 'enviando' | 'ok' | 'conflicto' | 'error';

interface DiaSemana {
  clave: string;
  nombre: string;
}

interface FranjaHoraria {
  inicio: string;
  fin: string;
  etiqueta: string;
}

export interface OcupacionSalon {
  aula: string;
  curso: string;
  docenteCodigo: string;
  origen: 'Regular' | 'Recuperación';
}

const DIAS_JS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DIAS_ES: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo'
};

const SALONES_PRINCIPALES = [
  'A101', 'A205', 'B108', 'B204', 'C302', 'D105',
  'E201', 'F305', 'G102', 'H203', 'I301', 'J402'
];

@Component({
  selector: 'app-registro-reprogramacion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registro-reprogramacion.component.html',
  styleUrl: './registro-reprogramacion.component.scss'
})
export class RegistroReprogramacionComponent implements OnInit {
  readonly reglas = [
    'El docente no puede tener otra clase (regular o reprogramada) en el mismo horario.',
    'Ningún estudiante matriculado en el curso puede presentar cruce con otra clase.',
    'El salón seleccionado debe estar disponible en el día y franja horaria solicitados.',
    'Debe existir un intervalo mínimo de 15 minutos entre clases consecutivas.',
    'La hora de fin debe ser posterior a la hora de inicio.'
  ];

  readonly diasSemana: DiaSemana[] = [
    { clave: 'MONDAY', nombre: 'Lunes' },
    { clave: 'TUESDAY', nombre: 'Martes' },
    { clave: 'WEDNESDAY', nombre: 'Miércoles' },
    { clave: 'THURSDAY', nombre: 'Jueves' },
    { clave: 'FRIDAY', nombre: 'Viernes' },
    { clave: 'SATURDAY', nombre: 'Sábado' },
    { clave: 'SUNDAY', nombre: 'Domingo' }
  ];

  readonly franjas: FranjaHoraria[] = [
    { inicio: '07:00', fin: '09:00', etiqueta: '07:00 – 09:00' },
    { inicio: '08:00', fin: '10:00', etiqueta: '08:00 – 10:00' },
    { inicio: '09:30', fin: '11:30', etiqueta: '09:30 – 11:30' },
    { inicio: '10:00', fin: '12:00', etiqueta: '10:00 – 12:00' },
    { inicio: '12:00', fin: '14:00', etiqueta: '12:00 – 14:00' },
    { inicio: '14:00', fin: '16:00', etiqueta: '14:00 – 16:00' },
    { inicio: '14:30', fin: '16:30', etiqueta: '14:30 – 16:30' },
    { inicio: '16:00', fin: '18:00', etiqueta: '16:00 – 18:00' },
    { inicio: '17:00', fin: '19:00', etiqueta: '17:00 – 19:00' },
    { inicio: '19:30', fin: '21:30', etiqueta: '19:30 – 21:30' }
  ];

  modelo: Reprogramacion = this.modeloVacio();

  esSoloEstudiante = false;
  esDocenteEnSesion = false;

  docentesCatalogo: Docente[] = [];
  docentesMap: Record<string, Docente> = {};
  horariosCatalogo: Horario[] = [];
  reprogramacionesCatalogo: Reprogramacion[] = [];
  salonesCatalogo: string[] = [...SALONES_PRINCIPALES];
  horariosDocente: Horario[] = [];

  salonFiltro = 'TODOS';

  estado: EstadoEnvio = 'idle';
  mensaje = '';

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
    if (sesion.rol === 'Estudiante') {
      this.esSoloEstudiante = true;
      this.router.navigate(['/consulta-horario']);
      return;
    }

    const preseleccionado = this.horarioService.consumirCursoPreseleccionado();

    if (sesion.rol === 'Docente' && sesion.codigo) {
      this.esDocenteEnSesion = true;
      this.modelo.docenteCodigo = sesion.codigo;
      if (preseleccionado?.docenteCodigo?.toUpperCase() === sesion.codigo.toUpperCase()) {
        this.modelo.curso = preseleccionado.curso;
      }
      this.cargarHorariosDocente(true);
    } else if (preseleccionado) {
      this.modelo.docenteCodigo = preseleccionado.docenteCodigo;
      this.modelo.curso = preseleccionado.curso;
      this.cargarHorariosDocente(false);
    }

    if (!this.modelo.fecha) {
      this.modelo.fecha = this.proximaFechaParaDia('MONDAY');
      this.modelo.horaInicio = '10:00';
      this.modelo.horaFin = '12:00';
    }

    forkJoin({
      docentes: this.docenteService.listar().pipe(catchError(() => of([] as Docente[]))),
      horarios: this.horarioService.listarTodos().pipe(catchError(() => of([] as Horario[]))),
      reprogramaciones: this.horarioService.listarTodasReprogramaciones().pipe(catchError(() => of([] as Reprogramacion[])))
    }).subscribe(({ docentes, horarios, reprogramaciones }) => {
      this.docentesCatalogo = docentes.filter(d => !d.codigo.toUpperCase().startsWith('COORD'));
      this.horariosCatalogo = horarios;
      this.reprogramacionesCatalogo = reprogramaciones;

      const mapa: Record<string, Docente> = {};
      for (const d of this.docentesCatalogo) {
        if (d.codigo) {
          mapa[d.codigo.toUpperCase()] = d;
        }
      }
      this.docentesMap = mapa;

      const aulas = new Set<string>(SALONES_PRINCIPALES);
      for (const h of horarios) {
        if (h.aula?.trim()) {
          aulas.add(h.aula.trim().toUpperCase());
        }
      }
      this.salonesCatalogo = [...aulas].sort();
      this.cdr.markForCheck();
    });
  }

  get docenteSeleccionado(): Docente | null {
    const cod = (this.modelo.docenteCodigo ?? '').trim().toUpperCase();
    return cod ? this.docentesMap[cod] ?? null : null;
  }

  get cursoSeleccionadoInfo(): Horario | null {
    const cur = (this.modelo.curso ?? '').trim().toLowerCase();
    if (!cur) {
      return null;
    }
    return this.horariosCatalogo.find(h => h.curso?.toLowerCase() === cur) ?? null;
  }

  get cursosSugeridos(): Horario[] {
    if (this.esDocenteEnSesion && this.horariosDocente.length) {
      const vistosDoc = new Set<string>();
      return this.horariosDocente.filter(h => {
        if (!h.curso || vistosDoc.has(h.curso)) {
          return false;
        }
        vistosDoc.add(h.curso);
        return true;
      });
    }

    const cod = (this.modelo.docenteCodigo ?? '').trim().toUpperCase();
    const fuente = cod && this.horariosCatalogo.some(h => h.docenteCodigo?.toUpperCase() === cod)
      ? this.horariosCatalogo.filter(h => h.docenteCodigo?.toUpperCase() === cod)
      : this.horariosCatalogo;

    const vistos = new Set<string>();
    const unicos: Horario[] = [];
    for (const h of fuente) {
      if (h.curso && !vistos.has(h.curso)) {
        vistos.add(h.curso);
        unicos.push(h);
      }
    }
    return unicos;
  }

  get diaSeleccionado(): string | null {
    return this.diaDeFecha(this.modelo.fecha);
  }

  get diaSeleccionadoEs(): string {
    const dia = this.diaSeleccionado;
    return dia ? DIAS_ES[dia] : '—';
  }

  get cargaDelDia(): Horario[] {
    const dia = this.diaSeleccionado;
    return dia ? this.horariosDocente.filter(h => h.dia === dia) : [];
  }

  get filtroEsGeneral(): boolean {
    return this.salonFiltro === 'TODOS';
  }

  get tieneFechaYFranja(): boolean {
    return Boolean(this.modelo.fecha && this.modelo.horaInicio && this.modelo.horaFin);
  }

  get salonesDisponiblesEnFranja(): string[] {
    if (!this.tieneFechaYFranja) {
      return [];
    }
    const ocupados = new Set(this.salonesOcupadosEnFranja.map(o => o.aula));
    return this.salonesCatalogo.filter(s => !ocupados.has(s));
  }

  get salonesOcupadosEnFranja(): OcupacionSalon[] {
    if (!this.tieneFechaYFranja) {
      return [];
    }
    const dia = this.diaDeFecha(this.modelo.fecha);
    if (!dia) {
      return [];
    }
    return this.obtenerOcupaciones(dia, this.modelo.horaInicio, this.modelo.horaFin, this.modelo.fecha);
  }

  salonesPrincipalesDisponibles(dia: string, franja: FranjaHoraria): string[] {
    const ocupados = new Set(this.ocupacionesEnCelda(dia, franja).map(o => o.aula));
    return SALONES_PRINCIPALES.filter(s => !ocupados.has(s));
  }

  ocupacionesEnCelda(dia: string, franja: FranjaHoraria): OcupacionSalon[] {
    return this.obtenerOcupaciones(dia, franja.inicio, franja.fin);
  }

  ocupacionDeSalonEnCelda(salon: string, dia: string, franja: FranjaHoraria): OcupacionSalon | null {
    const target = salon.toUpperCase();
    return this.ocupacionesEnCelda(dia, franja).find(o => o.aula === target) ?? null;
  }

  verTodosLosSalones(): void {
    this.salonFiltro = 'TODOS';
  }

  seleccionarSalon(aula: string): void {
    this.modelo.aula = aula;
    if (this.salonFiltro === 'TODOS') {
      this.salonFiltro = aula;
    }
  }

  seleccionarBloqueDisponible(dia: string, franja: FranjaHoraria, salon: string): void {
    if (!salon) {
      return;
    }
    this.modelo.aula = salon;
    this.modelo.horaInicio = franja.inicio;
    this.modelo.horaFin = franja.fin;
    this.modelo.fecha = this.proximaFechaParaDia(dia);
  }

  onDocenteChange(): void {
    if (this.esDocenteEnSesion) {
      return;
    }
    const cod = (this.modelo.docenteCodigo ?? '').trim().toUpperCase();
    if (cod && this.docentesMap[cod]) {
      this.modelo.docenteCodigo = cod;
      this.cargarHorariosDocente();
    } else if (!cod) {
      this.horariosDocente = [];
    }
  }

  onCursoChange(): void {
    const cur = (this.modelo.curso ?? '').trim();
    if (!cur) {
      return;
    }
    const encontrado = this.horariosCatalogo.find(h => h.curso?.toLowerCase() === cur.toLowerCase());
    if (encontrado && !(this.modelo.docenteCodigo ?? '').trim()) {
      this.modelo.docenteCodigo = encontrado.docenteCodigo;
      this.cargarHorariosDocente();
    }
  }

  cargarHorariosDocente(preseleccionarCurso = false): void {
    const codigo = (this.modelo.docenteCodigo ?? '').trim().toUpperCase();
    this.modelo.docenteCodigo = codigo;
    if (!codigo) {
      this.horariosDocente = [];
      return;
    }
    this.horarioService.horariosDocente(codigo).subscribe({
      next: hs => {
        this.horariosDocente = hs;
        if (preseleccionarCurso && !this.modelo.curso && hs.length > 0) {
          this.modelo.curso = hs[0].curso;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.horariosDocente = [];
        this.cdr.markForCheck();
      }
    });
  }

  nombreDocente(docenteCodigo: string): string {
    const d = this.docentesMap[docenteCodigo?.trim().toUpperCase()];
    return d ? `${d.nombres} ${d.apellidos}` : 'Docente titular';
  }

  diaEs(dia: string): string {
    return DIAS_ES[dia?.toUpperCase()] ?? dia;
  }

  normalizarHora(valor: string): string {
    const v = (valor ?? '').trim();
    return /^\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  }

  hora(valor: string): string {
    return (valor ?? '').slice(0, 5);
  }

  guardar(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const aulaLimpia = (this.modelo.aula ?? '').trim().toUpperCase();
    const payload: Reprogramacion = {
      docenteCodigo: this.modelo.docenteCodigo.trim().toUpperCase(),
      curso: this.modelo.curso.trim(),
      fecha: this.modelo.fecha,
      horaInicio: this.normalizarHora(this.modelo.horaInicio),
      horaFin: this.normalizarHora(this.modelo.horaFin),
      ...(aulaLimpia ? { aula: aulaLimpia } : {})
    };

    this.estado = 'enviando';
    this.mensaje = '';

    this.horarioService.reprogramar(payload).subscribe({
      next: texto => {
        this.estado = 'ok';
        this.mensaje = texto || 'Reprogramación registrada sin cruces.';
        this.horarioService.setUltimaReprogramacion(payload);
        this.recargarReprogramaciones();
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 400) {
          this.estado = 'conflicto';
          this.mensaje = typeof err.error === 'string' && err.error
            ? err.error
            : 'Se detectó un cruce de horario.';
        } else {
          this.estado = 'error';
          this.mensaje = err.status === 0
            ? 'No se pudo conectar con el servidor (http://localhost:8082).'
            : `Error inesperado del servidor (HTTP ${err.status}).`;
        }
        this.cdr.markForCheck();
      }
    });
  }

  limpiar(form: NgForm): void {
    const docenteFijo = this.esDocenteEnSesion ? this.modelo.docenteCodigo : '';
    const primerCurso = this.esDocenteEnSesion && this.cursosSugeridos.length ? this.cursosSugeridos[0].curso : '';
    form.resetForm();
    this.modelo = this.modeloVacio();
    this.modelo.docenteCodigo = docenteFijo;
    this.modelo.curso = primerCurso;
    this.modelo.fecha = this.proximaFechaParaDia('MONDAY');
    this.modelo.horaInicio = '10:00';
    this.modelo.horaFin = '12:00';
    if (!docenteFijo) {
      this.horariosDocente = [];
    }
    this.estado = 'idle';
    this.mensaje = '';
  }

  irAConfirmacion(): void {
    this.router.navigate(['/confirmacion']);
  }

  private recargarReprogramaciones(): void {
    this.horarioService.listarTodasReprogramaciones().pipe(catchError(() => of([] as Reprogramacion[])))
      .subscribe(reprogs => {
        this.reprogramacionesCatalogo = reprogs;
        this.cdr.markForCheck();
      });
  }

  private obtenerOcupaciones(dia: string, hi: string, hf: string, fechaExacta?: string): OcupacionSalon[] {
    const a = this.aMinutos(hi);
    const b = this.aMinutos(hf);
    if (b <= a) {
      return [];
    }
    const lista: OcupacionSalon[] = [];
    const vistos = new Set<string>();

    for (const h of this.horariosCatalogo) {
      if (h.dia === dia && h.aula?.trim() && this.solapan(h.horaInicio, h.horaFin, a, b)) {
        const aula = h.aula.trim().toUpperCase();
        const key = `${aula}|${h.curso}|R`;
        if (!vistos.has(key)) {
          vistos.add(key);
          lista.push({ aula, curso: h.curso, docenteCodigo: h.docenteCodigo, origen: 'Regular' });
        }
      }
    }

    for (const r of this.reprogramacionesCatalogo) {
      const coincideDia = fechaExacta ? r.fecha === fechaExacta : this.diaDeFecha(r.fecha) === dia;
      if (coincideDia && r.aula?.trim() && this.solapan(r.horaInicio, r.horaFin, a, b)) {
        const aula = r.aula.trim().toUpperCase();
        const key = `${aula}|${r.curso}|P`;
        if (!vistos.has(key)) {
          vistos.add(key);
          lista.push({ aula, curso: r.curso, docenteCodigo: r.docenteCodigo, origen: 'Recuperación' });
        }
      }
    }

    return lista.sort((x, y) => x.aula.localeCompare(y.aula));
  }

  private diaDeFecha(fecha?: string): string | null {
    if (!fecha) {
      return null;
    }
    const [y, m, d] = fecha.split('-').map(Number);
    if (!y || !m || !d) {
      return null;
    }
    return DIAS_JS[new Date(y, m - 1, d).getDay()];
  }

  private proximaFechaParaDia(diaObjetivo: string): string {
    const hoy = new Date();
    const targetIdx = DIAS_JS.indexOf(diaObjetivo);
    if (targetIdx < 0) {
      return '';
    }
    const diff = (targetIdx - hoy.getDay() + 7) % 7 || 7;
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diff);
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private solapan(hi: string, hf: string, inicioMin: number, finMin: number): boolean {
    const x = this.aMinutos(hi);
    const y = this.aMinutos(hf);
    return x < finMin && inicioMin < y;
  }

  private aMinutos(hhmm: string): number {
    const [h, m] = (hhmm ?? '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private modeloVacio(): Reprogramacion {
    return { docenteCodigo: '', curso: '', fecha: '', horaInicio: '', horaFin: '', aula: '' };
  }
}
