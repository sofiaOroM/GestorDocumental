import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_URL as U } from './config';
import {
  Actividad, Archivo, Carpeta, Comentario, Contenido, Pagina, Papelera, Permiso, Share,
  TipoRecurso, Usuario, UsuarioDir
} from './models';

const p = (o: Record<string, unknown>) => {
  let hp = new HttpParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') hp = hp.set(k, String(v));
  return hp;
};

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  // Auth y usuarios
  login(email: string, password: string) { return this.http.post<{ token: string; user: Usuario }>(`${U}/auth/login`, { email, password }); }
  me() { return this.http.get<Usuario>(`${U}/auth/me`); }
  directory() { return this.http.get<UsuarioDir[]>(`${U}/users/directory`); }
  users() { return this.http.get<Usuario[]>(`${U}/users`); }
  createUser(body: object) { return this.http.post<Usuario>(`${U}/users`, body); }
  updateUser(id: string, body: object) { return this.http.patch<Usuario>(`${U}/users/${id}`, body); }

  // Carpetas
  allFolders() { return this.http.get<Carpeta[]>(`${U}/folders`); }
  contents(parentId?: string) { return this.http.get<Contenido>(`${U}/folders/contents`, { params: p({ parentId }) }); }
  createFolder(nombre: string, parentId?: string) { return this.http.post<Carpeta>(`${U}/folders`, { nombre, parentId: parentId ?? null }); }
  renameFolder(id: string, nombre: string) { return this.http.patch(`${U}/folders/${id}`, { nombre }); }
  moveFolder(id: string, parentId: string | null) { return this.http.patch(`${U}/folders/${id}/move`, { parentId }); }
  deleteFolder(id: string) { return this.http.delete(`${U}/folders/${id}`); }

  // Archivos
  searchFiles(params: Record<string, unknown>) { return this.http.get<Pagina<Archivo>>(`${U}/files`, { params: p(params) }); }
  fileInfo(id: string) { return this.http.get<Archivo & { nivel: string }>(`${U}/files/${id}`); }
  upload(file: File, folderId?: string) {
    const fd = new FormData();
    fd.append('archivo', file, file.name);
    if (folderId) fd.append('folderId', folderId);
    return this.http.post<Archivo>(`${U}/files`, fd);
  }
  saveContent(id: string, file: File) {
    const fd = new FormData();
    fd.append('archivo', file, file.name);
    return this.http.put(`${U}/files/${id}/content`, fd);
  }
  text(id: string) { return firstValueFrom(this.http.get(`${U}/files/${id}/download`, { params: { inline: '1' }, responseType: 'text' })); }
  async download(id: string, nombre: string) {
    const blob = await firstValueFrom(this.http.get(`${U}/files/${id}/download`, { responseType: 'blob' }));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  }
  renameFile(id: string, nombre: string) { return this.http.patch(`${U}/files/${id}`, { nombre }); }
  moveFile(id: string, folderId: string | null) { return this.http.patch(`${U}/files/${id}/move`, { folderId }); }
  deleteFile(id: string) { return this.http.delete(`${U}/files/${id}`); }
  comments(id: string) { return this.http.get<Comentario[]>(`${U}/files/${id}/comments`); }
  addComment(id: string, texto: string) { return this.http.post<Comentario>(`${U}/files/${id}/comments`, { texto }); }

  // Compartición
  share(body: { resourceType: TipoRecurso; resourceId: string; userId: string; permission: Permiso }) { return this.http.post(`${U}/shares`, body); }
  sent() { return this.http.get<Share[]>(`${U}/shares/sent`); }
  received() { return this.http.get<Share[]>(`${U}/shares/received`); }
  sharesOf(tipo: TipoRecurso, id: string) { return this.http.get<Share[]>(`${U}/shares/resource/${tipo}/${id}`); }
  updateShare(id: string, permission: string) { return this.http.patch(`${U}/shares/${id}`, { permission }); }
  removeShare(id: string) { return this.http.delete(`${U}/shares/${id}`); }

  // Papelera
  trash() { return this.http.get<Papelera>(`${U}/trash`); }
  restore(tipo: TipoRecurso, id: string) { return this.http.post(`${U}/trash/${tipo}/${id}/restore`, {}); }
  purge(tipo: TipoRecurso, id: string) { return this.http.delete(`${U}/trash/${tipo}/${id}`); }
  emptyTrash() { return this.http.delete(`${U}/trash`); }

  // Actividad y reportes
  activity(params: Record<string, unknown>) { return this.http.get<Pagina<Actividad>>(`${U}/activity`, { params: p(params) }); }
  activityOf(tipo: TipoRecurso, id: string, page = 1) { return this.http.get<Pagina<Actividad>>(`${U}/activity/resource/${tipo}/${id}`, { params: p({ page, limit: 20 }) }); }
  report(path: string, params: Record<string, unknown>) { return this.http.get<any[]>(`${U}/reports/${path}`, { params: p(params) }); }
}
