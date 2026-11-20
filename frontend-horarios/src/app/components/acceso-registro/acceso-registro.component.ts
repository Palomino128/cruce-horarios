import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
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
  claseColor: 'celeste' | 'marino' | 'profundo';
  subtitulo: string;
  ejemplos: string[];
}

interface CuentaResumen {
  codigo: string;
  nombres: string;
  apellidos: string;
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
      claseColor: 'celeste',
      subtitulo: 'Consulta de horarios regulares, cursos, salones y clases de recuperación',
      ejemplos: ['U23231304', 'U23261984', 'U23235344', 'U25000001', 'U25002000']
    },
    {
      rol: 'Docente',
      titulo: 'Docentes',
      claseColor: 'marino',
      subtitulo: 'Horarios, disponibilidad de salones Lun–Dom y solicitud de reprogramaciones',
      ejemplos: ['DOC-101', 'DOC-102', 'DOC-103', 'DOC-104', 'DOC-105']
    },
    {
      rol: 'Coordinador Académico',
      titulo: 'Coordinador',
      claseColor: 'profundo',
      subtitulo: 'Supervisión general de horarios, confirmación y gestión de usuarios',
      ejemplos: ['COORD-01', 'COORD-02', 'COORD-03']
    }
  ];

  pasoPantalla: PasoPantalla = 'seleccion';
  rolSeleccionado: RolUsuario = 'Docente';

  codigo = '';
  password = '';
  mostrarPassword = false;

  busquedaCuenta = '';
  mostrarSugerencias = false;

  docentesCatalogo: Docente[] = [];
  coordinadoresCatalogo: Docente[] = [];
  estudiantesCatalogo: Estudiante[] = [];

  cargandoCatalogo = true;
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
    const preseleccion = this.horarioService.consumirRolPreseleccionadoLogin();
    if (preseleccion) {
      this.elegirPerfil(preseleccion);
    }

    forkJoin({
      docentes: this.docenteService.listar().pipe(catchError(() => of([] as Docente[]))),
      estudiantes: this.estudianteService.listar().pipe(catchError(() => of([] as Estudiante[])))
    }).subscribe(({ docentes, estudiantes }) => {
      this.docentesCatalogo = docentes.filter(d => !d.codigo.toUpperCase().startsWith('COORD'));
      this.coordinadoresCatalogo = docentes.filter(d => d.codigo.toUpperCase().startsWith('COORD'));
      this.estudiantesCatalogo = estudiantes;
      this.cargandoCatalogo = false;
      this.cdr.markForCheck();
    });
  }

  get formularioValido(): boolean {
    return Boolean(this.codigo.trim() && this.password.trim()) && !this.cargando;
  }

  get perfilActivo(): OpcionPerfil {
    return this.perfiles.find(p => p.rol === this.rolSeleccionado) ?? this.perfiles[0];
  }

  get cuentasDelPerfil(): CuentaResumen[] {
    if (this.rolSeleccionado === 'Estudiante') {
      return this.estudiantesCatalogo;
    }
    if (this.rolSeleccionado === 'Docente') {
      return this.docentesCatalogo;
    }
    return this.coordinadoresCatalogo;
  }

  get sugerenciasFiltradas(): CuentaResumen[] {
    const q = (this.busquedaCuenta || '').trim().toLowerCase();
    const lista = this.cuentasDelPerfil;
    if (!q) {
      return lista.slice(0, 10);
    }
    const matches: CuentaResumen[] = [];
    for (const c of lista) {
      const full = `${c.codigo} ${c.nombres} ${c.apellidos}`.toLowerCase();
      if (full.includes(q)) {
        matches.push(c);
        if (matches.length >= 12) {
          break;
        }
      }
    }
    return matches;
  }

  get placeholderCodigo(): string {
    if (this.rolSeleccionado === 'Estudiante') {
      return 'Ej. U23231304 o U25000001';
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
    this.password = '';
    this.busquedaCuenta = '';
    this.mostrarSugerencias = false;
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
    this.password = '';
    this.mostrarSugerencias = false;
  }

  seleccionarCuenta(c: CuentaResumen): void {
    this.codigo = c.codigo;
    this.busquedaCuenta = `${c.codigo} — ${c.nombres} ${c.apellidos}`;
    this.mostrarSugerencias = false;
    this.error = '';
  }

  onBuscarChange(valor: string): void {
    this.busquedaCuenta = valor;
    this.mostrarSugerencias = true;
    const cod = valor.split('—')[0].trim().toUpperCase();
    if (/^(DOC-\d+|COORD-\d+|U\d+)$/.test(cod)) {
      this.codigo = cod;
    }
    this.error = '';
  }

  usarEjemplo(cod: string): void {
    this.codigo = cod;
    this.busquedaCuenta = cod;
    this.mostrarSugerencias = false;
    this.error = '';
  }

  limpiarFormulario(): void {
    this.codigo = '';
    this.busquedaCuenta = '';
    this.password = '';
    this.mostrarSugerencias = false;
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
      this.error = 'Ingrese su contraseña institucional para iniciar sesión.';
      return;
    }
    this.codigo = cod;
    this.cargando = true;
    this.mostrarSugerencias = false;

    this.horarioService.login(this.rolSeleccionado, cod, this.password).subscribe({
      next: sesion => {
        this.cargando = false;
        this.horarioService.setSesionActiva(sesion);
        this.cdr.markForCheck();
        this.router.navigate(['/consulta-horario']);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        const msg = err.error && typeof err.error === 'object' && err.error.mensaje
          ? err.error.mensaje
          : err.status === 0
            ? 'No se pudo conectar con el servidor de autenticación (http://localhost:8082).'
            : 'Credenciales inválidas para el perfil seleccionado.';
        this.error = msg;
        this.cdr.markForCheck();
      }
    });
  }
}
