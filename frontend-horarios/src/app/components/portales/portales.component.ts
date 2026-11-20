import { Component, OnInit } from '@angular/core';
import { ConsultaHorarioComponent } from '../consulta-horario/consulta-horario.component';
import { RegistroReprogramacionComponent } from '../registro-reprogramacion/registro-reprogramacion.component';
import { ConfirmacionComponent } from '../confirmacion/confirmacion.component';
import { GestionUsuariosComponent } from '../gestion-usuarios/gestion-usuarios.component';
import { HorarioService } from '../../services/horario.service';

@Component({
  selector: 'app-portal-docente',
  standalone: true,
  imports: [ConsultaHorarioComponent, RegistroReprogramacionComponent, GestionUsuariosComponent],
  styleUrl: './portales.component.scss',
  template: `
    <div class="portal-page">
      <div class="portal-banner banner-docente">
        <div>
          <span class="portal-kicker">PERFIL DOCENTE · /docente</span>
          <h2>Portal del Docente</h2>
          <p>Consulta tu horario semanal, solicita reprogramaciones con validación en vivo y administra tus cursos.</p>
        </div>
        <span class="badge badge-info">Estado de solicitudes: Solicitado / Confirmado</span>
      </div>

      <app-consulta-horario [modoFijo]="'docente'"></app-consulta-horario>
      <app-registro-reprogramacion></app-registro-reprogramacion>
      <app-gestion-usuarios [seccion]="'docente'"></app-gestion-usuarios>
    </div>
  `
})
export class PortalDocenteComponent implements OnInit {
  constructor(private horarioService: HorarioService) { }
  ngOnInit(): void {
    this.horarioService.setRolActivo('Docente');
  }
}

@Component({
  selector: 'app-portal-estudiante',
  standalone: true,
  imports: [ConsultaHorarioComponent],
  styleUrl: './portales.component.scss',
  template: `
    <div class="portal-page">
      <div class="portal-banner banner-estudiante">
        <div>
          <span class="portal-kicker">PERFIL ESTUDIANTE · /estudiante</span>
          <h2>Portal del Estudiante</h2>
          <p>Visualiza tu horario semanal por bloques académicos de 45 min, tus salones asignados y recuperaciones.</p>
        </div>
        <span class="badge badge-info">Códigos institucionales: U + dígitos</span>
      </div>

      <app-consulta-horario [modoFijo]="'estudiante'"></app-consulta-horario>
    </div>
  `
})
export class PortalEstudianteComponent implements OnInit {
  constructor(private horarioService: HorarioService) { }
  ngOnInit(): void {
    this.horarioService.setRolActivo('Estudiante');
  }
}

@Component({
  selector: 'app-portal-coordinador',
  standalone: true,
  imports: [ConfirmacionComponent, GestionUsuariosComponent],
  styleUrl: './portales.component.scss',
  template: `
    <div class="portal-page">
      <div class="portal-banner banner-coordinador">
        <div>
          <span class="portal-kicker">PERFIL COORDINADOR ACADÉMICO · /coordinador</span>
          <h2>Portal del Coordinador Académico</h2>
          <p>Revisa solicitudes en estado Solicitado, aprueba o rechaza reprogramaciones y administra la comunidad académica.</p>
        </div>
        <span class="badge badge-navy">Aprobación / Rechazo: Coordinación</span>
      </div>

      <app-confirmacion></app-confirmacion>
      <app-gestion-usuarios [seccion]="'todos'"></app-gestion-usuarios>
    </div>
  `
})
export class PortalCoordinadorComponent implements OnInit {
  constructor(private horarioService: HorarioService) { }
  ngOnInit(): void {
    this.horarioService.setRolActivo('Coordinador Académico');
  }
}
