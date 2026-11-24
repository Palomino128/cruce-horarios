import { Routes } from '@angular/router';
import { AccesoRegistroComponent } from './components/acceso-registro/acceso-registro.component';
import { ConsultaHorarioComponent } from './components/consulta-horario/consulta-horario.component';
import { RegistroReprogramacionComponent } from './components/registro-reprogramacion/registro-reprogramacion.component';
import { ConfirmacionComponent } from './components/confirmacion/confirmacion.component';
import {
  PortalCoordinadorComponent,
  PortalDocenteComponent,
  PortalEstudianteComponent
} from './components/portales/portales.component';
import { GestionUsuariosComponent } from './components/gestion-usuarios/gestion-usuarios.component';
import { BasePresencialComponent } from './components/base-presencial/base-presencial.component';
import { authGuard, roleGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Pantalla inicial: Inicio de sesión con selección de rol (Estudiante / Docente / Coordinador)
  { path: 'login', component: AccesoRegistroComponent, data: { breadcrumb: 'Inicio de Sesión', paso: 1 } },
  { path: 'registro', component: AccesoRegistroComponent, data: { breadcrumb: 'Inicio de Sesión', paso: 1 } },

  // Consulta de horario (protegida)
  {
    path: 'consulta-horario',
    component: ConsultaHorarioComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Consulta de Horario', paso: 2 }
  },

  // Registro de reprogramación (Docente o Coordinador Académico)
  {
    path: 'registro-reprogramacion',
    component: RegistroReprogramacionComponent,
    canActivate: [authGuard, roleGuard],
    data: { breadcrumb: 'Registro de Reprogramación', paso: 3, roles: ['Docente', 'Coordinador Académico'] }
  },

  // Confirmación y constancia oficial (protegida)
  {
    path: 'confirmacion',
    component: ConfirmacionComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Confirmación', paso: 4 }
  },

  // Rutas complementarias protegidas por rol
  {
    path: 'docente',
    component: PortalDocenteComponent,
    canActivate: [authGuard, roleGuard],
    data: { breadcrumb: 'Docente', roles: ['Docente', 'Coordinador Académico'] }
  },
  {
    path: 'estudiante',
    component: PortalEstudianteComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Estudiante' }
  },
  {
    path: 'coordinador',
    component: PortalCoordinadorComponent,
    canActivate: [authGuard, roleGuard],
    data: { breadcrumb: 'Coordinador', roles: ['Coordinador Académico'] }
  },
  {
    path: 'gestion',
    component: GestionUsuariosComponent,
    canActivate: [authGuard, roleGuard],
    data: { seccion: 'todos', breadcrumb: 'Gestión de Usuarios', roles: ['Coordinador Académico'] }
  },
  {
    path: 'base-horarios',
    component: BasePresencialComponent,
    canActivate: [authGuard],
    data: { breadcrumb: 'Base Presencial (Aforo e Inscritos)' }
  },

  // Compatibilidad con enlaces anteriores
  { path: 'reprogramacion', redirectTo: 'registro-reprogramacion', pathMatch: 'full' },
  {
    path: 'consulta-docente',
    component: ConsultaHorarioComponent,
    canActivate: [authGuard, roleGuard],
    data: { modo: 'docente', breadcrumb: 'Consulta Docente', paso: 2, roles: ['Docente', 'Coordinador Académico'] }
  },
  {
    path: 'consulta-estudiante',
    component: ConsultaHorarioComponent,
    canActivate: [authGuard],
    data: { modo: 'estudiante', breadcrumb: 'Consulta Estudiante', paso: 2 }
  },

  { path: '**', redirectTo: 'login' }
];
