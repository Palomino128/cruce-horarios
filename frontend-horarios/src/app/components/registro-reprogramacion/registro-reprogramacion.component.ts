import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DisponibilidadPresencial, HorarioService, OpcionRecuperacion } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { Docente } from '../../models/docente.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

type EstadoEnvio = 'idle' | 'enviando' | 'ok' | 'conflicto' | 'error';
type FiltroRecomendacion = 'TODAS' | 'RECOMENDADAS' | 'BAJAS';

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
  readonly INTERVALO_MINUTOS = 15;
  readonly HORA_MIN_MINUTOS = 7 * 60;         // 07:00 am
  readonly HORA_MAX_MINUTOS = 22 * 60 + 30;   // 10:30 pm (22:30)
  readonly HORA_MAX_DOMINGO_MINUTOS = 14 * 60; // 02:00 pm (14:00)

  readonly reglas = [
    'La hora académica dura 45 minutos (sesiones de 90 min). Horario universitario: Lun–Sáb de 07:00 am a 10:30 pm; Domingos de 07:00 am a 02:00 pm.',
    'Los alumnos matriculados en el curso (mínimo 15 por sección, sin repetir estudiantes) ya están inscritos; el sistema calcula el porcentaje de asistencia.',
    'El sistema recomienda fechas y horarios con asistencia mayor al 50%, manteniendo visibles todas las opciones (altas y bajas).',
    'Debe existir un intervalo mínimo de 15 minutos de traslado del docente entre clases consecutivas.',
    'El salón seleccionado debe estar disponible en el día y franja solicitados.'
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
    { inicio: '07:00', fin: '08:30', etiqueta: '07:00 – 08:30 (2 h acad.)' },
    { inicio: '08:45', fin: '10:15', etiqueta: '08:45 – 10:15 (2 h acad.)' },
    { inicio: '10:30', fin: '12:00', etiqueta: '10:30 – 12:00 (2 h acad.)' },
    { inicio: '12:15', fin: '13:45', etiqueta: '12:15 – 13:45 (2 h acad.)' },
    { inicio: '14:00', fin: '15:30', etiqueta: '14:00 – 15:30 (2 h acad.)' },
    { inicio: '15:45', fin: '17:15', etiqueta: '15:45 – 17:15 (2 h acad.)' },
    { inicio: '17:30', fin: '19:00', etiqueta: '17:30 – 19:00 (2 h acad.)' },
    { inicio: '19:15', fin: '20:45', etiqueta: '19:15 – 20:45 (2 h acad.)' },
    { inicio: '21:00', fin: '22:30', etiqueta: '21:00 – 22:30 (2 h acad.)' }
  ];

  readonly motivosCatalogo: string[] = [
    'Feriado institucional',
    'Comisión / Evento académico',
    'Licencia / Salud docente',
    'Contingencia técnica o de infraestructura',
    'Acuerdo académico con la sección'
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

  verificandoDisponibilidad = false;
  disponibilidadPresencial: DisponibilidadPresencial | null = null;
  errorDisponibilidad = '';

  // Opciones recomendadas de fecha y hora (todas visibles: >50% recomendadas y <=50% bajas)
  cargandoRecomendaciones = false;
  opcionesRecuperacion: OpcionRecuperacion[] = [];
  filtroRecomendacion: FiltroRecomendacion = 'TODAS';
  paginaOpciones = 1;
  tamPaginaOpciones = 8;

  cargandoCatalogos = true;
  estado: EstadoEnvio = 'idle';
  mensaje = '';

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
    if (sesion.rol === 'Estudiante') {
      this.esSoloEstudiante = true;
      this.router.navigate(['/consulta-horario']);
      return;
    }

    const preseleccionado = this.horarioService.consumirCursoPreseleccionado();
    const borrador = this.horarioService.getBorradorReprogramacion();

    if (borrador && !preseleccionado) {
      this.modelo = {
        docenteCodigo: borrador.docenteCodigo,
        curso: borrador.curso,
        fecha: borrador.fecha,
        horaInicio: borrador.horaInicio,
        horaFin: borrador.horaFin,
        aula: borrador.aula ?? '',
        motivo: borrador.motivo || this.motivosCatalogo[0]
      };
      this.salonFiltro = borrador.salonFiltro || 'TODOS';
    }

    if (sesion.rol === 'Docente' && sesion.codigo) {
      this.esDocenteEnSesion = true;
      this.modelo.docenteCodigo = sesion.codigo;
      if (preseleccionado?.docenteCodigo?.toUpperCase() === sesion.codigo.toUpperCase()) {
        this.modelo.curso = preseleccionado.curso;
      }
      this.cargarHorariosDocente(!this.modelo.curso);
    } else if (preseleccionado) {
      this.modelo.docenteCodigo = preseleccionado.docenteCodigo;
      this.modelo.curso = preseleccionado.curso;
      this.cargarHorariosDocente(false);
    } else if (this.modelo.docenteCodigo) {
      this.cargarHorariosDocente(false);
    }

    if (!this.modelo.fecha) {
      this.modelo.fecha = this.proximaFechaParaDia('MONDAY');
      this.modelo.horaInicio = '08:45';
      this.modelo.horaFin = '10:15';
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
      this.cargandoCatalogos = false;

      if (this.modelo.docenteCodigo && this.modelo.curso) {
        this.cargarRecomendaciones();
      }
      this.cdr.markForCheck();
    });
  }

  // ===== VALIDACIONES VISUALES (Rango horario e Intervalo 15 min) =====

  get alertaRangoHorario(): string {
    if (!this.modelo.horaInicio || !this.modelo.horaFin) {
      return '';
    }
    const ini = this.aMinutos(this.modelo.horaInicio);
    const fin = this.aMinutos(this.modelo.horaFin);
    if (fin <= ini) {
      return 'La hora de fin debe ser posterior a la hora de inicio.';
    }
    if (this.diaSeleccionado === 'SUNDAY') {
      if (ini < this.HORA_MIN_MINUTOS || fin > this.HORA_MAX_DOMINGO_MINUTOS) {
        return 'Los domingos el horario universitario permitido es de 07:00 am a 02:00 pm (14:00).';
      }
    } else if (ini < this.HORA_MIN_MINUTOS || fin > this.HORA_MAX_MINUTOS) {
      return 'El horario universitario permitido de lunes a sábado es de 07:00 am a 10:30 pm (22:30).';
    }
    const duracion = fin - ini;
    if (duracion < 45 || duracion % 45 !== 0) {
      return `La duración debe ser múltiplo de la hora académica de 45 minutos (ej. 45 min, 90 min o 135 min). Actual: ${duracion} min.`;
    }
    return '';
  }

  esFranjaPermitidaEnDia(dia: string, franja: FranjaHoraria): boolean {
    if (dia === 'SUNDAY') {
      return this.aMinutos(franja.fin) <= this.HORA_MAX_DOMINGO_MINUTOS;
    }
    return true;
  }

  get alertaIntervaloTraslado(): string {
    if (!this.modelo.docenteCodigo || !this.modelo.fecha || !this.modelo.horaInicio || !this.modelo.horaFin) {
      return '';
    }
    const ini = this.aMinutos(this.modelo.horaInicio);
    const fin = this.aMinutos(this.modelo.horaFin);
    if (fin <= ini) {
      return '';
    }

    const dia = this.diaDeFecha(this.modelo.fecha);
    const docCod = this.modelo.docenteCodigo.trim().toUpperCase();

    const sesionesDocente: Array<{ curso: string; hi: string; hf: string }> = [];

    if (dia) {
      for (const h of this.horariosDocente) {
        if (h.dia === dia) {
          sesionesDocente.push({ curso: h.curso, hi: h.horaInicio, hf: h.horaFin });
        }
      }
    }

    for (const r of this.reprogramacionesCatalogo) {
      if (r.estado !== 'RECHAZADO' && r.docenteCodigo?.toUpperCase() === docCod && r.fecha === this.modelo.fecha) {
        sesionesDocente.push({ curso: `${r.curso} (Recuperación)`, hi: r.horaInicio, hf: r.horaFin });
      }
    }

    for (const s of sesionesDocente) {
      const sIni = this.aMinutos(s.hi);
      const sFin = this.aMinutos(s.hf);
      if (ini < sFin && fin > sIni) {
        return `Cruce directo detectado: el docente ya dicta "${s.curso}" de ${this.hora(s.hi)} a ${this.hora(s.hf)}.`;
      }
      const gapAntes = ini >= sFin ? ini - sFin : Number.POSITIVE_INFINITY;
      const gapDespues = sIni >= fin ? sIni - fin : Number.POSITIVE_INFINITY;
      const gapMin = Math.min(gapAntes, gapDespues);
      if (gapMin < this.INTERVALO_MINUTOS) {
        return `Intervalo de traslado insuficiente (${gapMin} min): se requieren al menos ${this.INTERVALO_MINUTOS} minutos entre "${s.curso}" (${this.hora(s.hi)}–${this.hora(s.hf)}) y la nueva sesión.`;
      }
    }

    return '';
  }

  get formularioListoParaGuardar(): boolean {
    return Boolean(
      this.modelo.docenteCodigo?.trim() &&
      this.modelo.curso?.trim() &&
      this.modelo.fecha &&
      this.modelo.horaInicio &&
      this.modelo.horaFin &&
      !this.alertaRangoHorario &&
      !this.alertaIntervaloTraslado &&
      this.estado !== 'enviando'
    );
  }

  get puedeVerificarDisponibilidad(): boolean {
    return Boolean(
      this.modelo.docenteCodigo?.trim() &&
      this.modelo.curso?.trim() &&
      this.modelo.fecha &&
      this.modelo.horaInicio &&
      this.modelo.horaFin &&
      !this.alertaRangoHorario &&
      !this.verificandoDisponibilidad
    );
  }

  // ===== OPCIONES DE RECUPERACIÓN (>50% recomendadas + <=50% visibles) =====

  get opcionesFiltradas(): OpcionRecuperacion[] {
    if (this.filtroRecomendacion === 'RECOMENDADAS') {
      return this.opcionesRecuperacion.filter(o => o.recomendada);
    }
    if (this.filtroRecomendacion === 'BAJAS') {
      return this.opcionesRecuperacion.filter(o => !o.recomendada);
    }
    return this.opcionesRecuperacion;
  }

  get totalPaginasOpciones(): number {
    return Math.max(1, Math.ceil(this.opcionesFiltradas.length / this.tamPaginaOpciones));
  }

  get opcionesPaginadas(): OpcionRecuperacion[] {
    const ini = (this.paginaOpciones - 1) * this.tamPaginaOpciones;
    return this.opcionesFiltradas.slice(ini, ini + this.tamPaginaOpciones);
  }

  cambiarFiltroRecomendacion(f: FiltroRecomendacion): void {
    this.filtroRecomendacion = f;
    this.paginaOpciones = 1;
  }

  cargarRecomendaciones(): void {
    const doc = (this.modelo.docenteCodigo ?? '').trim().toUpperCase();
    const cur = (this.modelo.curso ?? '').trim();
    if (!doc || !cur) {
      this.opcionesRecuperacion = [];
      return;
    }
    this.cargandoRecomendaciones = true;
    this.horarioService.recomendarOpcionesRecuperacion(doc, cur)
      .pipe(catchError(() => of([] as OpcionRecuperacion[])))
      .subscribe(opciones => {
        this.opcionesRecuperacion = opciones;
        this.paginaOpciones = 1;
        this.cargandoRecomendaciones = false;
        this.cdr.markForCheck();
      });
  }

  seleccionarOpcionRecomendada(op: OpcionRecuperacion): void {
    this.modelo.fecha = op.fecha;
    this.modelo.horaInicio = this.hora(op.horaInicio);
    this.modelo.horaFin = this.hora(op.horaFin);
    this.modelo.aula = op.aulaSugerida;
    this.guardarBorrador();
    this.verificarDisponibilidad();
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
    this.guardarBorrador();
  }

  seleccionarBloqueDisponible(dia: string, franja: FranjaHoraria, salon: string): void {
    if (!salon) {
      return;
    }
    this.modelo.aula = salon;
    this.modelo.horaInicio = franja.inicio;
    this.modelo.horaFin = franja.fin;
    this.modelo.fecha = this.proximaFechaParaDia(dia);
    this.disponibilidadPresencial = null;
    this.guardarBorrador();
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
    this.guardarBorrador();
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
    this.disponibilidadPresencial = null;
    this.guardarBorrador();
    if (this.modelo.docenteCodigo && this.modelo.curso) {
      this.cargarRecomendaciones();
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
        if (this.modelo.docenteCodigo && this.modelo.curso) {
          this.cargarRecomendaciones();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.horariosDocente = [];
        this.cdr.markForCheck();
      }
    });
  }

  verificarDisponibilidad(): void {
    if (!this.puedeVerificarDisponibilidad) {
      return;
    }
    this.verificandoDisponibilidad = true;
    this.errorDisponibilidad = '';
    this.disponibilidadPresencial = null;

    const payload = this.construirPayload();
    this.horarioService.consultarDisponibilidadPresencial(payload).subscribe({
      next: disp => {
        this.verificandoDisponibilidad = false;
        this.disponibilidadPresencial = disp;
        this.guardarBorrador();
        this.cdr.markForCheck();
      },
      error: () => {
        this.verificandoDisponibilidad = false;
        this.errorDisponibilidad = 'No se pudo consultar el porcentaje de asistencia en http://localhost:8082.';
        this.cdr.markForCheck();
      }
    });
  }

  guardar(form: NgForm): void {
    if (form.invalid || !this.formularioListoParaGuardar) {
      form.control.markAllAsTouched();
      return;
    }

    const payload = this.construirPayload();
    this.estado = 'enviando';
    this.mensaje = '';
    this.guardarBorrador();

    this.horarioService.reprogramar(payload).subscribe({
      next: texto => {
        this.estado = 'ok';
        this.mensaje = texto || 'Reprogramación registrada sin cruces.';
        this.horarioService.setUltimaReprogramacion(payload);
        const doc = this.docenteSeleccionado;
        this.horarioService.setUltimaConfirmacion({
          solicitudNumero: `#REP-2026-${String(Math.floor(1000 + Math.random() * 8999))}`,
          estado: 'SOLICITADO',
          mensaje: this.mensaje,
          docenteNombre: doc ? `${doc.nombres} ${doc.apellidos}` : undefined,
          reprogramacion: payload,
          fechaRegistro: new Date().toISOString(),
          disponibilidadPresencial: this.disponibilidadPresencial
        });
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
    this.disponibilidadPresencial = null;
    this.errorDisponibilidad = '';
    if (!docenteFijo) {
      this.horariosDocente = [];
      this.opcionesRecuperacion = [];
    }
    this.estado = 'idle';
    this.mensaje = '';
    this.horarioService.setBorradorReprogramacion(null);
  }

  regresar(): void {
    this.guardarBorrador();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/consulta-horario']);
    }
  }

  irAConfirmacion(): void {
    this.guardarBorrador();
    this.router.navigate(['/confirmacion']);
  }

  guardarBorrador(): void {
    this.horarioService.setBorradorReprogramacion({
      docenteCodigo: this.modelo.docenteCodigo,
      curso: this.modelo.curso,
      fecha: this.modelo.fecha,
      horaInicio: this.modelo.horaInicio,
      horaFin: this.modelo.horaFin,
      aula: this.modelo.aula,
      motivo: this.modelo.motivo,
      salonFiltro: this.salonFiltro
    });
  }

  nombreDocente(docenteCodigo: string): string {
    const d = this.docentesMap[docenteCodigo?.trim().toUpperCase()];
    return d ? `${d.nombres} ${d.apellidos}` : 'Docente titular';
  }

  diaEs(dia: string): string {
    return DIAS_ES[dia?.toUpperCase()] ?? dia;
  }

  fechaEs(fecha: string): string {
    const [y, m, d] = (fecha ?? '').split('-');
    return y && m && d ? `${d}/${m}/${y}` : fecha;
  }

  normalizarHora(valor: string): string {
    const v = (valor ?? '').trim();
    return /^\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  }

  hora(valor: string): string {
    return (valor ?? '').slice(0, 5);
  }

  private construirPayload(): Reprogramacion {
    const aulaLimpia = (this.modelo.aula ?? '').trim().toUpperCase();
    const motivoLimpio = (this.modelo.motivo ?? '').trim() || this.motivosCatalogo[0];
    return {
      docenteCodigo: this.modelo.docenteCodigo.trim().toUpperCase(),
      curso: this.modelo.curso.trim(),
      fecha: this.modelo.fecha,
      horaInicio: this.normalizarHora(this.modelo.horaInicio),
      horaFin: this.normalizarHora(this.modelo.horaFin),
      motivo: motivoLimpio,
      ...(aulaLimpia ? { aula: aulaLimpia } : {})
    };
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
      if (r.estado === 'RECHAZADO') continue;
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
    return {
      docenteCodigo: '',
      curso: '',
      fecha: '',
      horaInicio: '',
      horaFin: '',
      aula: '',
      motivo: 'Feriado institucional'
    };
  }
}
