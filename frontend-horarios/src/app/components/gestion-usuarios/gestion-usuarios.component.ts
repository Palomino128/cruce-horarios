import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DocenteService } from '../../services/docente.service';
import { EstudianteService } from '../../services/estudiante.service';
import { HorarioService, RolUsuario } from '../../services/horario.service';
import { Docente } from '../../models/docente.model';
import { Estudiante } from '../../models/estudiante.model';
import { Horario } from '../../models/horario.model';
import { Reprogramacion } from '../../models/reprogramacion.model';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  docenteFicha: Docente | null = null;
  docenteHorarios: Horario[] = [];
  docenteReprog: Reprogramacion[] = [];

  estudianteFicha: Estudiante | null = null;
  estudianteHorarios: Horario[] = [];

  coordinadorFicha: Docente | null = null;

  msgDocente = '';
  msgHorario = '';
  msgEstudiante = '';
  msgMatricula = '';
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
    private cdr: ChangeDetectorRef
  ) {
    this.docenteForm = this.fb.group({
      codigo: ['DOC-101', [Validators.required, Validators.pattern(/^(DOC-[0-9]{1,3}|COORD-[0-9]{1,3})$/i), Validators.maxLength(10)]]
    });

    this.horarioForm = this.fb.group({
      docenteCodigo: ['DOC-101', [Validators.required, Validators.maxLength(10)]],
      curso: ['', [Validators.required]],
      dia: ['MONDAY', [Validators.required]],
      horaInicio: ['08:00', [Validators.required]],
      horaFin: ['10:00', [Validators.required]],
      aula: ['A101', [Validators.required, Validators.pattern(/^[A-J][0-9]{1,3}$/), Validators.maxLength(4)]]
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
    this.docenteService.listar().subscribe({
      next: d => {
        this.docentes = d;
        this.cdr.markForCheck();
      }
    });
    this.estudianteService.listar().subscribe({
      next: e => {
        this.estudiantes = e;
        this.cdr.markForCheck();
      }
    });
    this.horarioService.listarTodasReprogramaciones().subscribe({
      next: r => {
        this.reprogramaciones = r;
        this.cdr.markForCheck();
      }
    });
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
        this.msgDocente = `Información cargada automáticamente para ${doc.codigo}.`;
        this.cdr.markForCheck();
      },
      error: () => {
        this.msgDocente = 'Error al identificar o registrar el código.';
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
      }
    });
  }

  registrarHorario(): void {
    this.msgHorario = '';
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
      error: () => {
        this.msgHorario = 'Error al registrar el horario.';
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
        this.estudianteFicha = est;
        this.horarioService.horariosEstudiante(est.codigo).subscribe({
          next: h => {
            this.estudianteHorarios = h;
            this.msgEstudiante = `Información cargada automáticamente para ${est.codigo}.`;
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
      error: () => {
        this.msgMatricula = 'Error al registrar la matrícula.';
        this.cdr.markForCheck();
      }
    });
  }

  confirmarSolicitud(r: Reprogramacion): void {
    if (!r.id) return;
    this.horarioService.confirmarReprogramacion(r.id).subscribe({
      next: act => {
        this.reprogramaciones = this.reprogramaciones.map(item => (item.id === act.id ? act : item));
        this.msgCoordinador = `Solicitud #${act.id} (${act.curso}) confirmada por el Coordinador Académico.`;
        this.cdr.markForCheck();
      }
    });
  }

  etiquetaEstado(estado?: string): string {
    return estado === 'CONFIRMADO' ? 'Confirmado' : 'Solicitado';
  }
}
