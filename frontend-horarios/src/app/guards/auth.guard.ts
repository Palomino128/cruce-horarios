import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HorarioService, RolUsuario } from '../services/horario.service';

export const authGuard: CanActivateFn = () => {
  const horarioService = inject(HorarioService);
  const router = inject(Router);
  if (horarioService.getSesionActiva()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const roleGuard: CanActivateFn = route => {
  const horarioService = inject(HorarioService);
  const router = inject(Router);
  const sesion = horarioService.getSesionActiva();
  if (!sesion) {
    return router.createUrlTree(['/login']);
  }
  const rolesPermitidos = route.data['roles'] as RolUsuario[] | undefined;
  if (!rolesPermitidos || rolesPermitidos.length === 0 || rolesPermitidos.includes(sesion.rol)) {
    return true;
  }
  return router.createUrlTree(['/consulta-horario']);
};
