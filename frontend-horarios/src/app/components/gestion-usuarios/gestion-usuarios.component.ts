import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DocenteService } from '../../services/docente.service';
import { EstudianteService } from '../../services/estudiante.service';
import { HorarioService, RolUsuario } from '../../services/horario.service';
import { Docente } from '../../models/docente.model';
import { Estudiante } from '../../models/estudiante.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

type FiltroEstadoReprog = 'TODAS' | 'SOLICITADO' | 'CONFIRMADO' | 'RECHAZADO';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.scss'
})
export class GestionUsuariosComponent implements OnInit {
  @Input() seccion: 'docente' | 'estudiante' | 'coordinador' | 'todos' = 'todos';
  rolActivo: RolUsuario = 'Coordinador Académico';

  docenteForm: FormGroup;
  horarioForm: FormGroup;
  estudianteForm: FormGroup;
  matriculaForm: FormGroup;
  coordinadorForm: FormGroup;

  docentes: Docente[] = [];
  estudiantes: Estudiante[] = [];
  reprogramaciones: Reprogramacion[] = [];

  filtroDocente = '';
  paginaDocentes = 1;
  tamPagina = 6;

  filtroEstudiante = '';
  paginaEstudiantes = 1;

  busquedaMatEst = '';
  mostrarSugMatEst = false;

  filtroEstadoReprog: FiltroEstadoReprog = 'TODAS';
  observacionesPorId: Record<number, string> = {};
  paginaReprog = 1;

  cargando = false;
  errorGeneral = '';

  docenteFicha: Docente | null = null;
  docenteHorarios: Horario[] = [];
  docenteReprog: Reprogramacion[] = [];

  estudianteFicha: Estudiante | null = null;
  estudianteHorarios: Horario[] = [];

  coordinadorFicha: Docente | null = null;

  msgDocente = '';
  msgHorario = '';
  errHorario = false;
  msgEstudiante = '';
  msgMatricula = '';
  errMatricula = false;
  msgCoordinador = '';

  readonly dias = [
    { key: 'MONDAY', label: 'Lunes' },
    { key: 'TUESDAY', label: 'Martes' },
    { key: 'WEDNESDAY', label: 'Miércoles' },
    { key: 'THURSDAY', label: 'Jueves' },
    { key: 'FRIDAY', label: 'Viernes' },
    { key: 'SATURDAY', label: 'Sábado' }
  ];

  constructor(
    private fb: FormBuilder,
    private docenteService: DocenteService,
    private estudianteService: EstudianteService,
    private horarioService: HorarioService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {
    this.docenteForm = this.fb.group({
      codigo: ['DOC-101', [Validators.required, Validators.pattern(/^(DOC-[0-9]{1,3}|COORD-[0-9]{1,3})$/i), Validators.maxLength(10)]]
    });

    this.horarioForm = this.fb.group({
      docenteCodigo: ['DOC-101', [Validators.required, Validators.maxLength(10)]],
      curso: ['', [Validators.required]],
      dia: ['MONDAY', [Validators.required]],
      horaInicio: ['08:45', [Validators.required]],
      horaFin: ['10:15', [Validators.required]],
      aula: ['A101', [Validators.required, Validators.pattern(/^[A-J][0-9]{1,3}$/i), Validators.maxLength(4)]]
    });

    this.estudianteForm = this.fb.group({
      codigo: ['U23231304', [Validators.required, Validators.pattern(/^U[0-9]{1,8}$/i), Validators.maxLength(9)]]
    });

    this.matriculaForm = this.fb.group({
      estudianteCodigo: ['U23231304', [Validators.required, Validators.maxLength(9)]],
      curso: ['', [Validators.required]]
    });

    this.coordinadorForm = this.fb.group({
      codigo: ['COORD-01', [Validators.required, Validators.maxLength(10)]]
    });
  }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      if (data['seccion']) {
        this.seccion = data['seccion'];
      }
    });
    this.horarioService.rolActivo$.subscribe(rol => {
      this.rolActivo = rol;
      this.cdr.markForCheck();
    });
    this.cargarTodo();
  }

  cargarTodo(): void {
    this.cargando = true;
    this.errorGeneral = '';
    forkJoin({
      docentes: this.docenteService.listar().pipe(catchError(() => of(null))),
      estudiantes: this.estudianteService.listar().pipe(catchError(() => of(null))),
      reprogramaciones: this.horarioService.listarTodasReprogramaciones().pipe(catchError(() => of(null)))
    }).subscribe(({ docentes, estudiantes, reprogramaciones }) => {
      this.cargando = false;
      if (!docentes && !estudiantes && !reprogramaciones) {
        this.errorGeneral = 'No se pudo conectar con los endpoints de gestión en http://localhost:8082/api.';
      }
      this.docentes = docentes ?? [];
      this.estudiantes = estudiantes ?? [];
      this.reprogramaciones = reprogramaciones ?? [];
      this.cdr.markForCheck();
    });
  }

  // KPIs ejecutivos de Coordinación
  get countPendientes(): number {
    return this.reprogramaciones.filter(r => r.estado !== 'CONFIRMADO' && r.estado !== 'RECHAZADO').length;
  }

  get countConfirmadas(): number {
    return this.reprogramaciones.filter(r => r.estado === 'CONFIRMADO').length;
  }

  get countRechazadas(): number {
    return this.reprogramaciones.filter(r => r.estado === 'RECHAZADO').length;
  }

  // Paginación Docentes
  get docentesFiltrados(): Docente[] {
    const q = this.filtroDocente.trim().toLowerCase();
    if (!q) return this.docentes;
    return this.docentes.filter(d =>
      `${d.codigo} ${d.nombres} ${d.apellidos}`.toLowerCase().includes(q)
    );
  }

  get totalPaginasDocentes(): number {
    return Math.max(1, Math.ceil(this.docentesFiltrados.length / this.tamPagina));
  }

  get docentesPaginados(): Docente[] {
    const ini = (this.paginaDocentes - 1) * this.tamPagina;
    return this.docentesFiltrados.slice(ini, ini + this.tamPagina);
  }

  // Paginación Estudiantes
  get estudiantesFiltrados(): Estudiante[] {
    const q = this.filtroEstudiante.trim().toLowerCase();
    if (!q) return this.estudiantes;
    return this.estudiantes.filter(e =>
      `${e.codigo} ${e.nombres} ${e.apellidos}`.toLowerCase().includes(q)
    );
  }

  get totalPaginasEstudiantes(): number {
    return Math.max(1, Math.ceil(this.estudiantesFiltrados.length / this.tamPagina));
  }

  get estudiantesPaginados(): Estudiante[] {
    const ini = (this.paginaEstudiantes - 1) * this.tamPagina;
    return this.estudiantesFiltrados.slice(ini, ini + this.tamPagina);
  }

  get sugerenciasMatEst(): Estudiante[] {
    const q = (this.busquedaMatEst || '').trim().toLowerCase();
    if (!q) return this.estudiantes.slice(0, 10);
    const matches: Estudiante[] = [];
    for (const e of this.estudiantes) {
      if (`${e.codigo} ${e.nombres} ${e.apellidos}`.toLowerCase().includes(q)) {
        matches.push(e);
        if (matches.length >= 12) break;
      }
    }
    return matches;
  }

  onBuscarMatEst(valor: string): void {
    this.busquedaMatEst = valor;
    this.mostrarSugMatEst = true;
    const cod = valor.split('—')[0].trim().toUpperCase();
    if (/^U\d+$/.test(cod)) {
      this.matriculaForm.patchValue({ estudianteCodigo: cod });
    }
  }

  seleccionarMatEst(est: Estudiante): void {
    this.matriculaForm.patchValue({ estudianteCodigo: est.codigo });
    this.busquedaMatEst = `${est.codigo} — ${est.nombres} ${est.apellidos}`;
    this.mostrarSugMatEst = false;
  }

  // Filtrado y paginación Reprogramaciones
  get reprogramacionesFiltradas(): Reprogramacion[] {
    if (this.filtroEstadoReprog === 'SOLICITADO') {
      return this.reprogramaciones.filter(r => r.estado !== 'CONFIRMADO' && r.estado !== 'RECHAZADO');
    }
    if (this.filtroEstadoReprog === 'CONFIRMADO') {
      return this.reprogramaciones.filter(r => r.estado === 'CONFIRMADO');
    }
    if (this.filtroEstadoReprog === 'RECHAZADO') {
      return this.reprogramaciones.filter(r => r.estado === 'RECHAZADO');
    }
    return this.reprogramaciones;
  }

  get totalPaginasReprog(): number {
    return Math.max(1, Math.ceil(this.reprogramacionesFiltradas.length / this.tamPagina));
  }

  get reprogramacionesPaginadas(): Reprogramacion[] {
    const ini = (this.paginaReprog - 1) * this.tamPagina;
    return this.reprogramacionesFiltradas.slice(ini, ini + this.tamPagina);
  }

  cambiarFiltroEstado(f: FiltroEstadoReprog): void {
    this.filtroEstadoReprog = f;
    this.paginaReprog = 1;
  }

  identificarORegistrarDocente(): void {
    this.msgDocente = '';
    if (this.docenteForm.invalid) {
      this.docenteForm.markAllAsTouched();
      return;
    }
    const codigo = this.docenteForm.value.codigo.trim().toUpperCase();
    this.docenteService.crear({ codigo, nombres: '', apellidos: '' }).subscribe({
      next: doc => {
        if (!this.docentes.some(x => x.codigo === doc.codigo)) {
          this.docentes = [...this.docentes, doc];
        }
        this.horarioForm.patchValue({ docenteCodigo: doc.codigo });
        this.cargarFichaDocente(doc);
        this.msgDocente = `Información cargada correctamente para ${doc.codigo}.`;
        this.cdr.markForCheck();
      },
      error: () => {
        this.msgDocente = 'Error al identificar o registrar el código en el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  private cargarFichaDocente(doc: Docente): void {
    this.docenteFicha = doc;
    forkJoin({
      horarios: this.horarioService.horariosDocente(doc.codigo).pipe(catchError(() => of([]))),
      reprog: this.horarioService.reprogramacionesDocente(doc.codigo).pipe(catchError(() => of([])))
    }).subscribe(res => {
      this.docenteHorarios = res.horarios;
      this.docenteReprog = res.reprog;
      this.cdr.markForCheck();
    });
  }

  identificarORegistrarCoordinador(): void {
    this.msgCoordinador = '';
    if (this.coordinadorForm.invalid) {
      this.coordinadorForm.markAllAsTouched();
      return;
    }
    const codigo = this.coordinadorForm.value.codigo.trim().toUpperCase();
    this.docenteService.crear({ codigo, nombres: '', apellidos: '' }).subscribe({
      next: coord => {
        this.coordinadorFicha = coord;
        this.msgCoordinador = `Coordinador ${coord.codigo} identificado (${coord.nombres} ${coord.apellidos}).`;
        this.cargarTodo();
        this.cdr.markForCheck();
      },
      error: () => {
        this.msgCoordinador = 'No se pudo identificar el código de coordinador.';
        this.cdr.markForCheck();
      }
    });
  }

  registrarHorario(): void {
    this.msgHorario = '';
    this.errHorario = false;
    if (this.horarioForm.invalid) {
      this.horarioForm.markAllAsTouched();
      return;
    }
    const v = this.horarioForm.value;
    const payload: Horario = {
      docenteCodigo: v.docenteCodigo.trim().toUpperCase(),
      curso: v.curso.trim(),
      dia: v.dia,
      horaInicio: v.horaInicio.length === 5 ? `${v.horaInicio}:00` : v.horaInicio,
      horaFin: v.horaFin.length === 5 ? `${v.horaFin}:00` : v.horaFin,
      aula: v.aula.trim().toUpperCase()
    };
    this.horarioService.registrarHorarioRegular(payload).subscribe({
      next: guardado => {
        this.msgHorario = `Horario registrado: ${guardado.curso} (${guardado.docenteCodigo}, Aula ${guardado.aula}).`;
        this.horarioForm.patchValue({ curso: '' });
        if (this.docenteFicha && this.docenteFicha.codigo === guardado.docenteCodigo) {
          this.docenteHorarios = [...this.docenteHorarios, guardado];
        }
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.errHorario = true;
        this.msgHorario = typeof err.error === 'string' && err.error
          ? err.error
          : 'Error al registrar el horario en el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  identificarORegistrarEstudiante(): void {
    this.msgEstudiante = '';
    if (this.estudianteForm.invalid) {
      this.estudianteForm.markAllAsTouched();
      return;
    }
    const codigo = this.estudianteForm.value.codigo.trim().toUpperCase();
    this.estudianteService.crear({ codigo, nombres: '', apellidos: '' }).subscribe({
      next: est => {
        if (!this.estudiantes.some(x => x.codigo === est.codigo)) {
          this.estudiantes = [...this.estudiantes, est];
        }
        this.matriculaForm.patchValue({ estudianteCodigo: est.codigo });
        this.busquedaMatEst = `${est.codigo} — ${est.nombres} ${est.apellidos}`;
        this.estudianteFicha = est;
        this.horarioService.horariosEstudiante(est.codigo).subscribe({
          next: h => {
            this.estudianteHorarios = h;
            this.msgEstudiante = `Información cargada correctamente para ${est.codigo}.`;
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.msgEstudiante = 'Error al identificar o registrar el código de estudiante.';
        this.cdr.markForCheck();
      }
    });
  }

  registrarMatricula(): void {
    this.msgMatricula = '';
    this.errMatricula = false;
    if (this.matriculaForm.invalid) {
      this.matriculaForm.markAllAsTouched();
      return;
    }
    const v = this.matriculaForm.value;
    const estCode = v.estudianteCodigo.trim().toUpperCase();
    this.horarioService.registrarMatricula(estCode, v.curso.trim()).subscribe({
      next: () => {
        this.msgMatricula = `Matrícula registrada: ${estCode} en ${v.curso}.`;
        this.matriculaForm.patchValue({ curso: '' });
        if (this.estudianteFicha && this.estudianteFicha.codigo === estCode) {
          this.horarioService.horariosEstudiante(estCode).subscribe(h => {
            this.estudianteHorarios = h;
            this.cdr.markForCheck();
          });
        }
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.errMatricula = true;
        this.msgMatricula = typeof err.error === 'string' && err.error
          ? err.error
          : 'Error al registrar la matrícula en el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  confirmarSolicitud(r: Reprogramacion): void {
    if (!r.id) return;
    const obs = (this.observacionesPorId[r.id] ?? '').trim();
    this.horarioService.confirmarReprogramacion(r.id, obs).subscribe({
      next: act => {
        this.reprogramaciones = this.reprogramaciones.map(item => (item.id === act.id ? act : item));
        this.msgCoordinador = `Solicitud #${act.id} (${act.curso}) confirmada por el Coordinador Académico.`;
        this.cdr.markForCheck();
      },
      error: () => {
        this.msgCoordinador = 'No se pudo confirmar la solicitud en el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  rechazarSolicitud(r: Reprogramacion): void {
    if (!r.id) return;
    const obs = (this.observacionesPorId[r.id] ?? '').trim() || 'Observada por Coordinación Académica.';
    this.horarioService.rechazarReprogramacion(r.id, obs).subscribe({
      next: act => {
        this.reprogramaciones = this.reprogramaciones.map(item => (item.id === act.id ? act : item));
        this.msgCoordinador = `Solicitud #${act.id} (${act.curso}) rechazada con observación.`;
        this.cdr.markForCheck();
      },
      error: () => {
        this.msgCoordinador = 'No se pudo rechazar la solicitud en el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  exportarReporteConsolidadoCsv(): void {
    const header = ['ID', 'Curso', 'Docente', 'Fecha', 'Hora Inicio', 'Hora Fin', 'Aula', 'Motivo', 'Asistencia (%)', 'Estado', 'Observacion Coordinador'];
    const rows = this.reprogramaciones.map(r => [
      r.id ?? '',
      r.curso,
      r.docenteCodigo,
      r.fecha,
      (r.horaInicio ?? '').slice(0, 5),
      (r.horaFin ?? '').slice(0, 5),
      r.aula || 'Por asignar',
      r.motivo || 'Recuperación programada',
      r.porcentajeAsistencia ?? 100,
      this.etiquetaEstado(r.estado),
      r.observacionCoordinador || ''
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_consolidado_reprogramaciones_utp.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.msgCoordinador = `Reporte consolidado exportado (${this.reprogramaciones.length} registro(s)).`;
  }

  etiquetaEstado(estado?: string): string {
    if (estado === 'CONFIRMADO') return 'Confirmado';
    if (estado === 'RECHAZADO') return 'Rechazado';
    return 'Solicitado';
  }

  regresar(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/login']);
    }
  }

  irAConsulta(): void {
    this.router.navigate(['/consulta-horario']);
  }
}
