import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HorarioService, RolUsuario, SesionUsuario } from '../../services/horario.service';

interface NavEnlace {
  ruta: string;
  texto: string;
}

interface BreadcrumbItem {
  label: string;
  ruta: string;
  activo: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly titulo = 'Sistema de Gestión de Horarios';
  readonly subtitulo = 'UTP · Portal Académico';

  rolActivo: RolUsuario = 'Coordinador Académico';
  sesionActiva: SesionUsuario | null = null;
  rutaActual = '/login';

  private subs = new Subscription();

  constructor(
    private horarioService: HorarioService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {
    this.rutaActual = this.router.url || '/login';
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

  get enPantallaAcceso(): boolean {
    return (
      this.rutaActual === '/' ||
      this.rutaActual.startsWith('/login') ||
      this.rutaActual.startsWith('/registro')
    );
  }

  get mostrarUsuarioYMenu(): boolean {
    return this.sesionActiva !== null && !this.enPantallaAcceso;
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
        { ruta: '/consulta-horario', texto: 'MIS HORARIOS Y RECUPERACIONES' }
      ];
    }
    if (this.sesionActiva.rol === 'Docente') {
      return [
        { ruta: '/consulta-horario', texto: 'MI HORARIO Y SALONES' },
        { ruta: '/registro-reprogramacion', texto: 'REPROGRAMACIÓN (LUN–DOM)' },
        { ruta: '/confirmacion', texto: 'CONFIRMACIÓN' }
      ];
    }
    return [
      { ruta: '/consulta-horario', texto: 'CONSULTA DE HORARIO' },
      { ruta: '/registro-reprogramacion', texto: 'REPROGRAMACIÓN' },
      { ruta: '/confirmacion', texto: 'CONFIRMACIÓN' },
      { ruta: '/gestion', texto: 'GESTIÓN DE USUARIOS' }
    ];
  }

  get breadcrumbs(): BreadcrumbItem[] {
    const url = this.rutaActual.split('?')[0];
    const items: BreadcrumbItem[] = [
      { label: 'Inicio de Sesión', ruta: '/login', activo: url === '/login' || url === '/registro' || url === '/' }
    ];

    if (url === '/' || url.startsWith('/login') || url.startsWith('/registro')) {
      return items;
    }

    if (url.startsWith('/gestion')) {
      items.push({ label: 'Gestión de Usuarios', ruta: '/gestion', activo: true });
      return items;
    }

    if (url.startsWith('/consulta-horario') || url.startsWith('/consulta-docente') || url.startsWith('/consulta-estudiante')) {
      items.push({ label: 'Consulta de Horario', ruta: '/consulta-horario', activo: true });
      return items;
    }

    if (url.startsWith('/registro-reprogramacion')) {
      items.push({ label: 'Consulta de Horario', ruta: '/consulta-horario', activo: false });
      items.push({ label: 'Registro de Reprogramación', ruta: '/registro-reprogramacion', activo: true });
      return items;
    }

    if (url.startsWith('/confirmacion')) {
      items.push({ label: 'Consulta de Horario', ruta: '/consulta-horario', activo: false });
      items.push({ label: 'Reprogramación', ruta: '/registro-reprogramacion', activo: false });
      items.push({ label: 'Confirmación', ruta: '/confirmacion', activo: true });
      return items;
    }

    return items;
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
