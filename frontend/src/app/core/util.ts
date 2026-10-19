export function fmtBytes(n: number | undefined | null): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 3);
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export const fmtFecha = (d?: string | null) => (d ? new Date(d).toLocaleString('es-GT') : '');

export function errMsg(e: any): string {
  if (e?.status === 0) return 'No se pudo conectar con el servidor';
  return e?.error?.error ?? 'Ocurrió un error inesperado';
}

export const PERMISOS: Record<string, string> = { read: 'Lectura', comment: 'Comentar', edit: 'Edición' };
export const NIVELES: Record<string, string> = { owner: 'Propietario', ...PERMISOS };

const ACCIONES: Record<string, string> = {
  login: 'Inicio de sesión', create_user: 'Usuario creado', update_user: 'Usuario modificado',
  create_folder: 'Carpeta creada', upload: 'Archivo subido', download: 'Descarga', view: 'Vista previa',
  edit: 'Contenido editado', rename: 'Renombrado', move: 'Movido', trash: 'Enviado a papelera',
  restore: 'Restaurado', permanent_delete: 'Eliminado definitivamente', share: 'Compartido',
  share_update: 'Permiso modificado', unshare: 'Acceso retirado', comment: 'Comentario'
};
export const accionLabel = (a: string) => ACCIONES[a] ?? a;
export const tipoLabel = (t: string) => (t === 'file' ? 'Archivo' : t === 'folder' ? 'Carpeta' : 'Usuario');
