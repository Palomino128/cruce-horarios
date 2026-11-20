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

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Pantalla inicial de Login y registro por rol (Estudiante / Docente / Coordinador)
  { path: 'login', component: AccesoRegistroComponent },
  { path: 'registro', component: AccesoRegistroComponent },

  // Rutas principales
  { path: 'consulta-horario', component: ConsultaHorarioComponent },
  { path: 'registro-reprogramacion', component: RegistroReprogramacionComponent },
  { path: 'confirmacion', component: ConfirmacionComponent },

  // Rutas complementarias existentes (portales por rol y gestión)
  { path: 'docente', component: PortalDocenteComponent },
  { path: 'estudiante', component: PortalEstudianteComponent },
  { path: 'coordinador', component: PortalCoordinadorComponent },
  { path: 'gestion', component: GestionUsuariosComponent, data: { seccion: 'todos' } },

  // Compatibilidad con enlaces anteriores
  { path: 'reprogramacion', redirectTo: 'registro-reprogramacion', pathMatch: 'full' },
  { path: 'consulta-docente', component: ConsultaHorarioComponent, data: { modo: 'docente' } },
  { path: 'consulta-estudiante', component: ConsultaHorarioComponent, data: { modo: 'estudiante' } },

  { path: '**', redirectTo: 'login' }
];
