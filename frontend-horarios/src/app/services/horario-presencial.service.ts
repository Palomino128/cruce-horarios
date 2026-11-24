import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AulaAforo,
  HorarioPresencialPage,
  ValidacionAsignacionRequest,
  ValidacionAsignacionResponse
} from '../models/horario-presencial.model';

@Injectable({ providedIn: 'root' })
export class HorarioPresencialService {
  private readonly api = 'http://localhost:8082/api/horarios-presenciales';

  constructor(private http: HttpClient) {}

  listar(params: {
    q?: string;
    dia?: string;
    clase?: string;
    soloSobrecupo?: boolean;
    page?: number;
    size?: number;
  }): Observable<HorarioPresencialPage> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 20));
    if (params.q?.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }
    if (params.dia?.trim()) {
      httpParams = httpParams.set('dia', params.dia.trim());
    }
    if (params.clase?.trim()) {
      httpParams = httpParams.set('clase', params.clase.trim());
    }
    if (params.soloSobrecupo) {
      httpParams = httpParams.set('soloSobrecupo', 'true');
    }
    return this.http.get<HorarioPresencialPage>(this.api, { params: httpParams });
  }

  listarAulas(): Observable<AulaAforo[]> {
    return this.http.get<AulaAforo[]>(`${this.api}/aulas`);
  }

  validarAsignacion(req: ValidacionAsignacionRequest): Observable<ValidacionAsignacionResponse> {
    return this.http.post<ValidacionAsignacionResponse>(`${this.api}/validar-asignacion`, req);
  }
}
