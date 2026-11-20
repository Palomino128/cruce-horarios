import { ChangeDetectorRef, Component, Input, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HorarioService } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { EstudianteService } from '../../services/estudiante.service';
import { Docente } from '../../models/docente.model';
import { Estudiante } from '../../models/estudiante.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';
import { etiquetaCortaAula, etiquetaUbicacionAula, obtenerInfoAula } from '../../utils/sedes-utp.util';

export type TipoConsulta = 'docente' | 'estudiante';
type ModoVisualizacion = 'tabla' | 'calendario';

interface Persona {
  codigo: string;
  nombres: string;
  apellidos: string;
}

interface BloqueAcademico {
  inicio: string;
  fin: string;
  etiqueta: string;
}

interface EventoCalendario {
  tipo: 'regular' | 'recuperacion';
  curso: string;
  aula: string;
  docenteCodigo: string;
  detalle: string;
}

const DIAS_ES: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo'
};

const DIAS_JS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const ORDEN_DIAS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

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
  selector: 'app-consulta-horario',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './consulta-horario.component.html',
  styleUrl: './consulta-horario.component.scss'
})
export class ConsultaHorarioComponent implements OnInit {
  @Input() modoFijo?: TipoConsulta;

  readonly bloquesAcademicos = BLOQUES_ACADEMICOS;
  readonly diasCalendario = ORDEN_DIAS.map(clave => ({ clave, nombre: DIAS_ES[clave] }));

  tipo: TipoConsulta = 'docente';
  codigo = 'DOC-101';
  readonly modoVista = signal<ModoVisualizacion>('tabla');
  mostrarSugerencias = false;

  esVistaPropia = false;
  soloEstudiante = false;
  esDocenteLogueado = false;

  docentesCatalogo: Docente[] = [];
  estudiantesCatalogo: Estudiante[] = [];
  docentesMap: Record<string, Docente> = {};

  persona: Persona | null = null;
  horarios: Horario[] = [];
  reprogramaciones: Reprogramacion[] = [];

  paginaHorarios = 1;
  tamPaginaHorarios = 5;

  paginaReprog = 1;
  tamPaginaReprog = 5;

  cargando = false;
  buscado = false;
  error = '';

  constructor(
    private horarioService: HorarioService,
    private docenteService: DocenteService,
    private estudianteService: EstudianteService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const modoRuta = this.route.snapshot.data['modo'] as TipoConsulta | undefined;
    const modo = this.modoFijo ?? modoRuta;
    const sesion = this.horarioService.getSesionActiva();
    const consultaPrevia = this.horarioService.getEstadoConsulta();

    if (!modo && !sesion) {
      this.router.navigate(['/login']);
      return;
    }

    if (modo) {
      this.tipo = modo;
      this.codigo = consultaPrevia && consultaPrevia.tipo === modo
        ? consultaPrevia.codigo
        : (modo === 'docente' ? 'DOC-101' : 'U23231304');
      this.buscar();
    } else if (sesion) {
      if (sesion.rol === 'Estudiante') {
        this.esVistaPropia = true;
        this.soloEstudiante = true;
        this.tipo = 'estudiante';
        this.codigo = sesion.codigo;
        this.buscar();
      } else if (sesion.rol === 'Docente') {
        this.esVistaPropia = true;
        this.esDocenteLogueado = true;
        this.tipo = 'docente';
        this.codigo = sesion.codigo;
        this.buscar();
      } else {
        this.esVistaPropia = false;
        this.tipo = consultaPrevia?.tipo ?? 'docente';
        this.codigo = consultaPrevia?.codigo ?? 'DOC-101';
        this.buscar();
      }
    }

    this.cargarCatalogos();
  }

  get placeholder(): string {
    return this.tipo === 'docente' ? 'Código o apellido (ej. DOC-101)' : 'Código o apellido (ej. U23231304)';
  }

  get sugerenciasBusqueda(): Persona[] {
    const q = (this.codigo || '').trim().toLowerCase();
    const lista: Persona[] = this.tipo === 'docente' ? this.docentesCatalogo : this.estudiantesCatalogo;
    if (!q) {
      return lista.slice(0, 10);
    }
    const res: Persona[] = [];
    for (const p of lista) {
      if (`${p.codigo} ${p.nombres} ${p.apellidos}`.toLowerCase().includes(q)) {
        res.push(p);
        if (res.length >= 12) break;
      }
    }
    return res;
  }

  get cargaSemanalHoras(): number {
    const minutos = this.horarios.reduce(
      (acc, h) => acc + Math.max(0, this.aMinutos(h.horaFin) - this.aMinutos(h.horaInicio)),
      0
    );
    return Math.round((minutos / 60) * 10) / 10;
  }

  get horasAcademicasSemanales(): number {
    const minutos = this.horarios.reduce(
      (acc, h) => acc + Math.max(0, this.aMinutos(h.horaFin) - this.aMinutos(h.horaInicio)),
      0
    );
    return Math.round(minutos / 45);
  }

  get diasConClase(): number {
    return new Set(this.horarios.map(h => h.dia)).size;
  }

  get salonesAsignados(): string[] {
    const unicos = new Set<string>();
    for (const h of this.horarios) {
      if (h.aula?.trim()) {
        unicos.add(h.aula.trim().toUpperCase());
      }
    }
    for (const r of this.reprogramaciones) {
      if (r.estado !== 'RECHAZADO' && r.aula?.trim()) {
        unicos.add(r.aula.trim().toUpperCase());
      }
    }
    return [...unicos];
  }

  get salonesResumen(): string {
    if (!this.salonesAsignados.length) {
      return 'Sin asignar';
    }
    return this.salonesAsignados
      .map(s => `${s} (${etiquetaCortaAula(s)})`)
      .join(' · ');
  }

  etiquetaAulaSede(aula?: string): string {
    return etiquetaUbicacionAula(aula);
  }

  etiquetaAulaCorta(aula?: string): string {
    return etiquetaCortaAula(aula);
  }

  esAulaSubterranea(aula?: string): boolean {
    return obtenerInfoAula(aula).esSubterranea;
  }

  get totalPaginasHorarios(): number {
    return Math.max(1, Math.ceil(this.horarios.length / this.tamPaginaHorarios));
  }

  get horariosPaginados(): Horario[] {
    const ini = (this.paginaHorarios - 1) * this.tamPaginaHorarios;
    return this.horarios.slice(ini, ini + this.tamPaginaHorarios);
  }

  cambiarVista(modo: ModoVisualizacion): void {
    this.modoVista.set(modo);
    this.cdr.detectChanges();
    if (typeof document !== 'undefined') {
      const panel = document.getElementById('vistaHorarioPanel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  cambiarTamPaginaHorarios(tam: number): void {
    this.tamPaginaHorarios = Number(tam) || 5;
    this.paginaHorarios = 1;
    this.cdr.markForCheck();
  }

  cambiarPaginaHorarios(delta: number): void {
    const next = this.paginaHorarios + delta;
    if (next >= 1 && next <= this.totalPaginasHorarios) {
      this.paginaHorarios = next;
      this.cdr.markForCheck();
    }
  }

  get totalPaginasReprog(): number {
    return Math.max(1, Math.ceil(this.reprogramaciones.length / this.tamPaginaReprog));
  }

  get reprogramacionesPaginadas(): Reprogramacion[] {
    const ini = (this.paginaReprog - 1) * this.tamPaginaReprog;
    return this.reprogramaciones.slice(ini, ini + this.tamPaginaReprog);
  }

  cambiarPaginaReprog(delta: number): void {
    const next = this.paginaReprog + delta;
    if (next >= 1 && next <= this.totalPaginasReprog) {
      this.paginaReprog = next;
      this.cdr.markForCheck();
    }
  }

  get puedeContinuarAReprogramacion(): boolean {
    return !this.soloEstudiante && !this.cargando && this.persona !== null;
  }

  esBloqueCerrado(diaClave: string, bloque: BloqueAcademico): boolean {
    return diaClave === 'SUNDAY' && this.aMinutos(bloque.fin) > 14 * 60;
  }

  eventosEnCelda(diaClave: string, bloque: BloqueAcademico): EventoCalendario[] {
    const iniB = this.aMinutos(bloque.inicio);
    const finB = this.aMinutos(bloque.fin);
    const eventos: EventoCalendario[] = [];

    for (const h of this.horarios) {
      if (h.dia === diaClave && this.solapan(h.horaInicio, h.horaFin, iniB, finB)) {
        eventos.push({
          tipo: 'regular',
          curso: h.curso,
          aula: h.aula || 'Por asignar',
          docenteCodigo: h.docenteCodigo,
          detalle: `${this.hora(h.horaInicio)}–${this.hora(h.horaFin)}`
        });
      }
    }

    for (const r of this.reprogramaciones) {
      if (r.estado === 'RECHAZADO') continue;
      const diaR = this.diaDeFecha(r.fecha);
      if (diaR === diaClave && this.solapan(r.horaInicio, r.horaFin, iniB, finB)) {
        eventos.push({
          tipo: 'recuperacion',
          curso: r.curso,
          aula: r.aula || 'Por asignar',
          docenteCodigo: r.docenteCodigo,
          detalle: `Recup. ${this.fechaEs(r.fecha)}`
        });
      }
    }

    return eventos;
  }

  cambiarTipo(tipo: TipoConsulta): void {
    if (this.soloEstudiante && tipo !== 'estudiante') {
      return;
    }
    if (this.tipo === tipo) {
      return;
    }
    this.tipo = tipo;
    this.codigo = tipo === 'docente' ? 'DOC-101' : 'U23231304';
    this.mostrarSugerencias = false;
    this.limpiarResultados();
  }

  seleccionarSugerencia(p: Persona): void {
    this.codigo = p.codigo;
    this.mostrarSugerencias = false;
    this.buscar();
  }

  limpiarBusqueda(): void {
    this.codigo = '';
    this.mostrarSugerencias = false;
    this.limpiarResultados();
  }

  buscar(): void {
    const codigo = this.codigo.trim().toUpperCase();
    if (!codigo) {
      this.error = 'Ingrese un código institucional para realizar la búsqueda.';
      return;
    }
    this.codigo = codigo;
    this.mostrarSugerencias = false;
    this.horarioService.setEstadoConsulta({ tipo: this.tipo, codigo });
    this.limpiarResultados();
    this.cargando = true;

    const persona$ = (this.tipo === 'docente'
      ? this.docenteService.buscarPorCodigo(codigo)
      : this.estudianteService.buscarPorCodigo(codigo)
    ).pipe(catchError(() => of(null)));

    const horarios$ = (this.tipo === 'docente'
      ? this.horarioService.horariosDocente(codigo)
      : this.horarioService.horariosEstudiante(codigo)
    ).pipe(catchError(() => of([] as Horario[])));

    const reprogramaciones$ = (this.tipo === 'docente'
      ? this.horarioService.reprogramacionesDocente(codigo)
      : this.horarioService.reprogramacionesEstudiante(codigo)
    ).pipe(catchError(() => of([] as Reprogramacion[])));

    forkJoin({ persona: persona$, horarios: horarios$, reprogramaciones: reprogramaciones$ }).subscribe({
      next: ({ persona, horarios, reprogramaciones }) => {
        this.cargando = false;
        this.buscado = true;
        if (!persona) {
          this.error = `No se encontró ${this.tipo === 'docente' ? 'el docente' : 'el estudiante'} con código ${codigo}.`;
          this.cdr.markForCheck();
          return;
        }
        this.persona = persona;
        this.horarios = [...horarios].sort(
          (a, b) =>
            ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia) ||
            this.aMinutos(a.horaInicio) - this.aMinutos(b.horaInicio)
        );
        this.reprogramaciones = reprogramaciones;
        this.paginaHorarios = 1;
        this.paginaReprog = 1;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargando = false;
        this.buscado = true;
        this.error = 'No se pudo conectar con el servidor (http://localhost:8082).';
        this.cdr.markForCheck();
      }
    });
  }

  irARecuperarCurso(h: Horario): void {
    this.horarioService.setCursoPreseleccionado({
      docenteCodigo: h.docenteCodigo,
      curso: h.curso
    });
    this.router.navigate(['/registro-reprogramacion']);
  }

  continuarAReprogramacion(): void {
    if (this.tipo === 'docente' && this.persona) {
      const primerCurso = this.horarios.length ? this.horarios[0].curso : '';
      this.horarioService.setCursoPreseleccionado({
        docenteCodigo: this.persona.codigo,
        curso: primerCurso
      });
    }
    this.router.navigate(['/registro-reprogramacion']);
  }

  regresar(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/login']);
    }
  }

  cerrarSesion(): void {
    this.horarioService.cerrarSesion();
    this.router.navigate(['/login']);
  }

  nombreDocente(docenteCodigo: string): string {
    const d = this.docentesMap[docenteCodigo?.trim().toUpperCase()];
    return d ? `${d.nombres} ${d.apellidos}` : 'Docente asignado';
  }

  diaEs(dia: string): string {
    return DIAS_ES[dia?.toUpperCase()] ?? dia;
  }

  hora(valor: string): string {
    return (valor ?? '').slice(0, 5);
  }

  fechaEs(fecha: string): string {
    const [y, m, d] = (fecha ?? '').split('-');
    return y && m && d ? `${d}/${m}/${y}` : fecha;
  }

  etiquetaEstadoReprog(estado?: string): string {
    if (estado === 'CONFIRMADO') return 'Confirmado';
    if (estado === 'RECHAZADO') return 'Rechazado';
    return 'Solicitado';
  }

  private diaDeFecha(fecha?: string): string | null {
    if (!fecha) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    if (!y || !m || !d) return null;
    return DIAS_JS[new Date(y, m - 1, d).getDay()];
  }

  private solapan(hi: string, hf: string, inicioMin: number, finMin: number): boolean {
    const x = this.aMinutos(hi);
    const y = this.aMinutos(hf);
    return x < finMin && inicioMin < y;
  }

  private cargarCatalogos(): void {
    forkJoin({
      docentes: this.docenteService.listar().pipe(catchError(() => of([] as Docente[]))),
      estudiantes: this.estudianteService.listar().pipe(catchError(() => of([] as Estudiante[])))
    }).subscribe(({ docentes, estudiantes }) => {
      this.docentesCatalogo = docentes.filter(d => !d.codigo.toUpperCase().startsWith('COORD'));
      this.estudiantesCatalogo = estudiantes;
      const mapa: Record<string, Docente> = {};
      for (const d of this.docentesCatalogo) {
        if (d.codigo) {
          mapa[d.codigo.toUpperCase()] = d;
        }
      }
      this.docentesMap = mapa;
      this.cdr.markForCheck();
    });
  }

  private limpiarResultados(): void {
    this.persona = null;
    this.horarios = [];
    this.reprogramaciones = [];
    this.paginaHorarios = 1;
    this.paginaReprog = 1;
    this.error = '';
    this.buscado = false;
  }

  private aMinutos(hhmm: string): number {
    const [h, m] = (hhmm ?? '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
}
