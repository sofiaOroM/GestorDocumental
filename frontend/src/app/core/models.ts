export type Rol = 'admin' | 'user';
export type Permiso = 'read' | 'comment' | 'edit';
export type Nivel = 'owner' | 'edit' | 'comment' | 'read';
export type TipoRecurso = 'file' | 'folder';

export interface Usuario {
  _id: string; nombre: string; email: string; rol: Rol; activo: boolean;
  almacenamientoUsado: number; createdAt: string;
}
export interface UsuarioDir { _id: string; nombre: string; email: string; }

export interface Carpeta {
  _id: string; nombre: string; ownerId: string; parentId: string | null;
  ancestors: string[]; createdAt: string; updatedAt: string;
  deletedAt?: string | null; contiene?: { carpetas: number; archivos: number };
}
export interface Archivo {
  _id: string; nombre: string; extension: 'txt' | 'md'; size: number; ownerId: string;
  folderId: string | null; createdAt: string; updatedAt: string; deletedAt?: string | null;
}
export interface Contenido {
  carpeta: Carpeta | null; nivel: Nivel;
  ruta: { _id: string; nombre: string }[]; carpetas: Carpeta[]; archivos: Archivo[];
}
export interface Share {
  _id: string; resourceType: TipoRecurso; resourceId: string; permission: Permiso; createdAt: string;
  owner: UsuarioDir; sharedWith: UsuarioDir;
  recurso: { _id: string; nombre: string; extension?: string; size?: number };
}
export interface Actividad {
  _id: string; userId: string; userName: string; action: string; resourceType: string;
  resourceId: string; resourceName: string; details: any; timestamp: string;
}
export interface Pagina<T> { total: number; page: number; limit: number; items: T[]; }
export interface Comentario { _id: string; userName: string; texto: string; createdAt: string; }
export interface Papelera { carpetas: Carpeta[]; archivos: Archivo[]; }
