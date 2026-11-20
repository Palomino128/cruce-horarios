import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HorarioService, RolUsuario, SesionUsuario } from '../../services/horario.service';

interface NavEnlace {
  ruta: string;
  texto: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly titulo = 'Sistema de Verificación de Cruce de Horarios';
  readonly subtitulo = 'Portal Académico UTP';

  rolActivo: RolUsuario = 'Coordinador Académico';
  sesionActiva: SesionUsuario | null = null;
  rutaActual = '';

  private subs = new Subscription();

  constructor(
    private horarioService: HorarioService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {
    this.rutaActual = this.router.url;
  }

  ngOnInit(): void {
    this.subs.add(
      this.horarioService.rolActivo$.subscribe(rol => {
        this.rolActivo = rol;
        this.cdr.markForCheck();
      })
    );
    this.subs.add(
      this.horarioService.sesionActiva$.subscribe(sesion => {
        this.sesionActiva = sesion;
        this.cdr.markForCheck();
      })
    );
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(ev => {
          this.rutaActual = ev.urlAfterRedirects;
          this.cdr.markForCheck();
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get mostrarUsuarioYMenu(): boolean {
    const enLogin =
      this.rutaActual === '/' ||
      this.rutaActual.startsWith('/login') ||
      this.rutaActual.startsWith('/registro');
    return this.sesionActiva !== null && !enLogin;
  }

  get nombreUsuario(): string {
    const s = this.sesionActiva;
    return s ? `${s.codigo} · ${s.nombres} ${s.apellidos}` : '';
  }

  get iniciales(): string {
    const s = this.sesionActiva;
    if (!s) {
      return '';
    }
    const n = (s.nombres ?? '').trim().charAt(0);
    const a = (s.apellidos ?? '').trim().charAt(0);
    return (`${n}${a}`).toUpperCase() || s.codigo.slice(0, 2);
  }

  get enlaces(): NavEnlace[] {
    if (!this.sesionActiva) {
      return [];
    }
    if (this.sesionActiva.rol === 'Estudiante') {
      return [
        { ruta: '/consulta-horario', texto: 'MIS HORARIOS, SALONES Y RECUPERACIONES' }
      ];
    }
    if (this.sesionActiva.rol === 'Docente') {
      return [
        { ruta: '/consulta-horario', texto: 'MI HORARIO, CURSOS Y SALONES' },
        { ruta: '/registro-reprogramacion', texto: 'RECUPERAR CLASE (SALONES LUN–DOM)' },
        { ruta: '/confirmacion', texto: 'CONSTANCIA DE CONFIRMACIÓN' }
      ];
    }
    return [
      { ruta: '/consulta-horario', texto: 'CONSULTAR HORARIO' },
      { ruta: '/registro-reprogramacion', texto: 'REGISTRAR REPROGRAMACIÓN' },
      { ruta: '/confirmacion', texto: 'CONFIRMACIÓN' }
    ];
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
}
