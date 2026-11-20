import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HorarioService } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { EstudianteService } from '../../services/estudiante.service';
import { Docente } from '../../models/docente.model';
import { Estudiante } from '../../models/estudiante.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

export type TipoConsulta = 'docente' | 'estudiante';

interface Persona {
  codigo: string;
  nombres: string;
  apellidos: string;
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

const ORDEN_DIAS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

@Component({
  selector: 'app-consulta-horario',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink],
  templateUrl: './consulta-horario.component.html',
  styleUrl: './consulta-horario.component.scss'
})
export class ConsultaHorarioComponent implements OnInit {
  /** Permite fijar el tipo de consulta cuando el componente se incrusta en un portal. */
  @Input() modoFijo?: TipoConsulta;

  tipo: TipoConsulta = 'docente';
  codigo = 'DOC-101';

  esVistaPropia = false;
  soloEstudiante = false;
  esDocenteLogueado = false;

  docentesCatalogo: Docente[] = [];
  estudiantesCatalogo: Estudiante[] = [];
  docentesMap: Record<string, Docente> = {};

  persona: Persona | null = null;
  horarios: Horario[] = [];
  reprogramaciones: Reprogramacion[] = [];

  cargando = false;
  buscado = false;
  error = '';

  constructor(
    private horarioService: HorarioService,
    private docenteService: DocenteService,
    private estudianteService: EstudianteService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const modoRuta = this.route.snapshot.data['modo'] as TipoConsulta | undefined;
    const modo = this.modoFijo ?? modoRuta;
    const sesion = this.horarioService.getSesionActiva();

    if (!modo && !sesion) {
      this.router.navigate(['/login']);
      return;
    }

    if (modo) {
      this.cambiarTipo(modo);
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
        this.tipo = 'docente';
        this.codigo = 'DOC-101';
        this.buscar();
      }
    }

    this.cargarCatalogos();
  }

  get placeholder(): string {
    return this.tipo === 'docente' ? 'Ej. DOC-101' : 'Ej. U23231304 o U24000001';
  }

  get cargaSemanalHoras(): number {
    const minutos = this.horarios.reduce(
      (acc, h) => acc + Math.max(0, this.aMinutos(h.horaFin) - this.aMinutos(h.horaInicio)),
      0
    );
    return Math.round((minutos / 60) * 10) / 10;
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
      if (r.aula?.trim()) {
        unicos.add(r.aula.trim().toUpperCase());
      }
    }
    return [...unicos];
  }

  get salonesResumen(): string {
    return this.salonesAsignados.length ? this.salonesAsignados.join(', ') : 'Sin asignar';
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
    this.limpiarResultados();
  }

  limpiarBusqueda(): void {
    this.codigo = '';
    this.limpiarResultados();
  }

  buscar(): void {
    const codigo = this.codigo.trim().toUpperCase();
    if (!codigo) {
      this.error = 'Ingrese un código para realizar la búsqueda.';
      return;
    }
    this.codigo = codigo;
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
    this.error = '';
    this.buscado = false;
  }

  private aMinutos(hhmm: string): number {
    const [h, m] = (hhmm ?? '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
}
