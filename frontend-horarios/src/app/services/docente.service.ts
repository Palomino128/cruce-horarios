import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Docente } from '../models/docente.model';

@Injectable({ providedIn: 'root' })
export class DocenteService {
  private readonly api = 'http://localhost:8082/api/docentes';

  constructor(private http: HttpClient) {}

  listar(): Observable<Docente[]> {
    return this.http.get<Docente[]>(this.api);
  }

  buscarPorCodigo(codigo: string): Observable<Docente> {
    return this.http.get<Docente>(`${this.api}/${encodeURIComponent(codigo)}`);
  }

  crear(docente: Docente): Observable<Docente> {
    return this.http.post<Docente>(this.api, docente);
  }
}
