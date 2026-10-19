import { col } from '../db.js';
import { HttpError } from './http.js';

export const LEVEL = { read: 1, comment: 2, edit: 3, owner: 4 };
export const LEVEL_NAME = { 0: 'none', 1: 'read', 2: 'comment', 3: 'edit', 4: 'owner' };

// Nivel de acceso del usuario sobre un recurso:
//  - dueño => owner
//  - share directo sobre el recurso, o sobre cualquier carpeta ancestro (herencia)
//  - se toma el nivel más alto encontrado
export async function getLevel(user, tipo, recurso) {
  if (recurso.ownerId.equals(user._id)) return LEVEL.owner;

  const conds = [];
  let carpetas = [];
  if (tipo === 'file') {
    conds.push({ resourceType: 'file', resourceId: recurso._id });
    if (recurso.folderId) {
      const padre = await col('folders').findOne(
        { _id: recurso.folderId },
        { projection: { ancestors: 1 } }
      );
      if (padre) carpetas = [recurso.folderId, ...padre.ancestors];
    }
  } else {
    carpetas = [recurso._id, ...recurso.ancestors];
  }
  if (carpetas.length) conds.push({ resourceType: 'folder', resourceId: { $in: carpetas } });

  const shares = await col('shares').find({ sharedWithId: user._id, $or: conds }).toArray();
  return shares.reduce((max, s) => Math.max(max, LEVEL[s.permission]), 0);
}

// Carga un recurso y verifica que el usuario tenga al menos el nivel "minimo".
// Los recursos en papelera solo son accesibles para su dueño y solo si se pide explícitamente.
export async function loadResource(user, tipo, id, minimo, { permitirPapelera = false } = {}) {
  const coleccion = tipo === 'file' ? 'files' : 'folders';
  const recurso = await col(coleccion).findOne({ _id: id });
  const etiqueta = tipo === 'file' ? 'Archivo' : 'Carpeta';
  if (!recurso || (recurso.deletedAt && !permitirPapelera))
    throw new HttpError(404, `${etiqueta} no encontrado`);

  const nivel = await getLevel(user, tipo, recurso);
  if (nivel < minimo || (recurso.deletedAt && nivel < LEVEL.owner))
    throw new HttpError(403, 'No tienes permiso para realizar esta acción sobre este recurso');
  return { recurso, nivel };
}
