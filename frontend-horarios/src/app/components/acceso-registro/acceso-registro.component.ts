import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HorarioService, RolUsuario } from '../../services/horario.service';
import { DocenteService } from '../../services/docente.service';
import { EstudianteService } from '../../services/estudiante.service';
import { Docente } from '../../models/docente.model';
import { Estudiante } from '../../models/estudiante.model';

type PasoPantalla = 'seleccion' | 'login';

interface OpcionPerfil {
  rol: RolUsuario;
  titulo: string;
  claseColor: 'azul' | 'negro' | 'rojo';
  subtitulo: string;
  ejemplos: string[];
}

@Component({
  selector: 'app-acceso-registro',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './acceso-registro.component.html',
  styleUrl: './acceso-registro.component.scss'
})
export class AccesoRegistroComponent implements OnInit {
  readonly perfiles: OpcionPerfil[] = [
    {
      rol: 'Estudiante',
      titulo: 'Estudiantes',
      claseColor: 'azul',
      subtitulo: '1,000 cuentas habilitadas · Consulta de horarios, cursos, salones y recuperaciones',
      ejemplos: ['U23231304', 'U23261984', 'U23235344', 'U23200101', 'U24000001']
    },
    {
      rol: 'Docente',
      titulo: 'Docentes',
      claseColor: 'negro',
      subtitulo: '50 cuentas habilitadas · Horarios, cursos, salones y disponibilidad de lunes a domingo',
      ejemplos: ['DOC-101', 'DOC-102', 'DOC-103', 'DOC-104', 'DOC-105']
    },
    {
      rol: 'Coordinador Académico',
      titulo: 'Coordinador',
      claseColor: 'rojo',
      subtitulo: '3 cuentas habilitadas · Supervisión general de horarios y reprogramaciones',
      ejemplos: ['COORD-01', 'COORD-02', 'COORD-03']
    }
  ];

  pasoPantalla: PasoPantalla = 'seleccion';
  rolSeleccionado: RolUsuario = 'Estudiante';

  codigo = '';
  password = 'utp2026';
  mostrarPassword = false;

  docentesCatalogo: Docente[] = [];
  coordinadoresCatalogo: Docente[] = [];
  estudiantesCatalogo: Estudiante[] = [];

  cargando = false;
  error = '';

  constructor(
    private horarioService: HorarioService,
    private docenteService: DocenteService,
    private estudianteService: EstudianteService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.horarioService.cerrarSesion();

    forkJoin({
      docentes: this.docenteService.listar().pipe(catchError(() => of([] as Docente[]))),
      estudiantes: this.estudianteService.listar().pipe(catchError(() => of([] as Estudiante[])))
    }).subscribe(({ docentes, estudiantes }) => {
      this.docentesCatalogo = docentes.filter(d => !d.codigo.toUpperCase().startsWith('COORD'));
      this.coordinadoresCatalogo = docentes.filter(d => d.codigo.toUpperCase().startsWith('COORD'));
      this.estudiantesCatalogo = estudiantes;
      this.cdr.markForCheck();
    });
  }

  get perfilActivo(): OpcionPerfil {
    return this.perfiles.find(p => p.rol === this.rolSeleccionado) ?? this.perfiles[0];
  }

  get cuentasDelPerfil(): Array<{ codigo: string; nombres: string; apellidos: string }> {
    if (this.rolSeleccionado === 'Estudiante') {
      return this.estudiantesCatalogo;
    }
    if (this.rolSeleccionado === 'Docente') {
      return this.docentesCatalogo;
    }
    return this.coordinadoresCatalogo;
  }

  get placeholderCodigo(): string {
    if (this.rolSeleccionado === 'Estudiante') {
      return 'Ej. U23231304 o U24000001';
    }
    if (this.rolSeleccionado === 'Docente') {
      return 'Ej. DOC-101';
    }
    return 'Ej. COORD-01';
  }

  elegirPerfil(rol: RolUsuario): void {
    this.rolSeleccionado = rol;
    this.pasoPantalla = 'login';
    this.error = '';
    this.mostrarPassword = false;
    this.password = 'utp2026';
    if (rol === 'Estudiante') {
      this.codigo = 'U23231304';
    } else if (rol === 'Docente') {
      this.codigo = 'DOC-101';
    } else {
      this.codigo = 'COORD-01';
    }
  }

  volverASeleccion(): void {
    this.pasoPantalla = 'seleccion';
    this.error = '';
  }

  usarEjemplo(cod: string): void {
    this.codigo = cod;
    this.password = this.password || 'utp2026';
    this.error = '';
  }

  limpiarFormulario(): void {
    this.codigo = '';
    this.password = '';
    this.error = '';
  }

  togglePassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  iniciarSesion(): void {
    this.error = '';
    const cod = (this.codigo ?? '').trim().toUpperCase();
    if (!cod) {
      this.error = 'Seleccione o ingrese su código institucional para iniciar sesión.';
      return;
    }
    if (!this.password || !this.password.trim()) {
      this.error = 'Ingrese su contraseña para iniciar sesión.';
      return;
    }
    this.codigo = cod;
    this.cargando = true;

    if (this.rolSeleccionado === 'Estudiante') {
      this.estudianteService.buscarPorCodigo(cod).subscribe({
        next: est => {
          this.cargando = false;
          this.horarioService.setSesionActiva({
            rol: 'Estudiante',
            codigo: est.codigo,
            nombres: est.nombres,
            apellidos: est.apellidos
          });
          this.cdr.markForCheck();
          this.router.navigate(['/consulta-horario']);
        },
        error: () => {
          this.cargando = false;
          this.error = `La cuenta de estudiante ${cod} no existe en el padrón registrado.`;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    if (this.rolSeleccionado === 'Docente' && cod.startsWith('COORD')) {
      this.cargando = false;
      this.error = `El código ${cod} pertenece al perfil Coordinador. Cambie de perfil para ingresar.`;
      return;
    }

    if (this.rolSeleccionado === 'Coordinador Académico' && !cod.startsWith('COORD')) {
      this.cargando = false;
      this.error = 'Para Coordinador Académico utilice una cuenta oficial registrada (COORD-01, COORD-02 o COORD-03).';
      return;
    }

    this.docenteService.buscarPorCodigo(cod).subscribe({
      next: persona => {
        this.cargando = false;
        this.horarioService.setSesionActiva({
          rol: this.rolSeleccionado,
          codigo: persona.codigo,
          nombres: persona.nombres,
          apellidos: persona.apellidos
        });
        this.cdr.markForCheck();
        this.router.navigate(['/consulta-horario']);
      },
      error: () => {
        this.cargando = false;
        this.error = `La cuenta ${cod} no se encuentra registrada en el sistema.`;
        this.cdr.markForCheck();
      }
    });
  }
}
