import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Estudiante } from '../models/estudiante.model';

@Injectable({ providedIn: 'root' })
export class EstudianteService {
  private readonly api = 'http://localhost:8082/api/estudiantes';

  constructor(private http: HttpClient) {}

  listar(): Observable<Estudiante[]> {
    return this.http.get<Estudiante[]>(this.api);
  }

  buscarPorCodigo(codigo: string): Observable<Estudiante> {
    return this.http.get<Estudiante>(`${this.api}/${encodeURIComponent(codigo)}`);
  }

  crear(estudiante: Estudiante): Observable<Estudiante> {
    return this.http.post<Estudiante>(this.api, estudiante);
  }
}
