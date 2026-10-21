import { Router } from 'express';
import { col } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError, oid } from '../utils/http.js';
import { LEVEL, loadResource } from '../utils/access.js';
import { logActivity } from '../utils/activity.js';
import { deleteContent } from '../utils/gridfs.js';
import { reparentFolder, uniqueName } from '../utils/tree.js';

const router = Router();
router.use(authenticate);
const folders = () => col('folders');
const files = () => col('files');
const TIPOS = ['file', 'folder'];

// Solo se listan las "raíces" de eliminación (lo que el usuario eliminó directamente).
router.get('/', async (req, res) => {
  const filtro = { ownerId: req.user._id, deletedAt: { $ne: null }, $expr: { $eq: ['$trashRootId', '$_id'] } };
  const [carpetas, archivos] = await Promise.all([
    folders().find(filtro).sort({ deletedAt: -1 }).toArray(),
    files().find(filtro, { projection: { gridFsId: 0 } }).sort({ deletedAt: -1 }).toArray()
  ]);
  for (const c of carpetas) {
    const [nf, na] = await Promise.all([
      folders().countDocuments({ trashRootId: c._id, _id: { $ne: c._id } }),
      files().countDocuments({ trashRootId: c._id })
    ]);
    c.contiene = { carpetas: nf, archivos: na };
  }
  res.json({ carpetas, archivos });
});

async function cargarRaiz(req) {
  const tipo = req.params.tipo;
  if (!TIPOS.includes(tipo)) throw new HttpError(400, 'Tipo inválido');
  const { recurso } = await loadResource(req.user, tipo, oid(req.params.id), LEVEL.owner, { permitirPapelera: true });
  if (!recurso.deletedAt) throw new HttpError(400, 'El recurso no está en la papelera');
  if (!recurso.trashRootId?.equals(recurso._id))
    throw new HttpError(400, 'Solo se puede operar sobre el elemento que fue eliminado directamente');
  return { tipo, recurso };
}

// ---- Restaurar ----
router.post('/:tipo/:id/restore', async (req, res) => {
  const { tipo, recurso } = await cargarRaiz(req);
  const limpiar = { deletedAt: null, deletedBy: null, trashRootId: null };
  const now = new Date();

  if (tipo === 'file') {
    // Si la carpeta original ya no existe (o también está en papelera) => raíz
    let folderId = recurso.folderId ?? null;
    if (folderId && !(await folders().findOne({ _id: folderId, deletedAt: null }, { projection: { _id: 1 } })))
      folderId = null;
    const nombre = await uniqueName('files', recurso.ownerId, 'folderId', folderId, recurso.nombre, true);
    await files().updateOne({ _id: recurso._id }, { $set: { ...limpiar, folderId, nombre, updatedAt: now } });
    await logActivity(req.user, 'restore', 'file', { ...recurso, nombre }, { folderId });
    return res.json({ ok: true, nombre, folderId });
  }

  const padre = recurso.parentId
    ? await folders().findOne({ _id: recurso.parentId, deletedAt: null })
    : null;
  const nombre = await uniqueName('folders', recurso.ownerId, 'parentId', padre?._id ?? null, recurso.nombre, false);

  // Restaura toda la cascada que se eliminó junto con esta carpeta
  await folders().updateMany({ trashRootId: recurso._id }, { $set: limpiar });
  await files().updateMany({ trashRootId: recurso._id }, { $set: limpiar });
  await folders().updateOne({ _id: recurso._id }, { $set: { nombre, updatedAt: now } });
  if (recurso.parentId && !padre) await reparentFolder(recurso, null); // padre perdido => raíz

  await logActivity(req.user, 'restore', 'folder', { ...recurso, nombre });
  res.json({ ok: true, nombre, enRaiz: !padre });
});

// ---- Eliminación definitiva ----
// Borra: contenido GridFS, metadatos, shares y comentarios; descuenta almacenamiento.
// Conserva: activity_log (auditoría).
async function eliminarDefinitivo(user, tipo, recurso) {
  let carpetasIds = [];
  let archivos;
  if (tipo === 'file') {
    archivos = [recurso];
  } else {
    const desc = await folders().find({ ancestors: recurso._id }, { projection: { _id: 1 } }).toArray();
    carpetasIds = [recurso._id, ...desc.map((d) => d._id)];
    archivos = await files().find({ folderId: { $in: carpetasIds } }).toArray();
  }

  for (const a of archivos) await deleteContent(a.gridFsId);
  const archivosIds = archivos.map((a) => a._id);
  const liberado = archivos.reduce((s, a) => s + a.size, 0);

  if (archivosIds.length) {
    await files().deleteMany({ _id: { $in: archivosIds } });
    await col('comments').deleteMany({ fileId: { $in: archivosIds } });
  }
  if (carpetasIds.length) await folders().deleteMany({ _id: { $in: carpetasIds } });
  await col('shares').deleteMany({ resourceId: { $in: [...archivosIds, ...carpetasIds] } });
  await col('users').updateOne({ _id: recurso.ownerId }, { $inc: { almacenamientoUsado: -liberado } });

  await logActivity(user, 'permanent_delete', tipo, recurso, {
    archivos: archivosIds.length, carpetas: carpetasIds.length, bytesLiberados: liberado
  });
  return { archivos: archivosIds.length, carpetas: carpetasIds.length, bytesLiberados: liberado };
}

router.delete('/:tipo/:id', async (req, res) => {
  const { tipo, recurso } = await cargarRaiz(req);
  res.json({ ok: true, ...(await eliminarDefinitivo(req.user, tipo, recurso)) });
});

// Vaciar papelera
router.delete('/', async (req, res) => {
  const filtro = { ownerId: req.user._id, deletedAt: { $ne: null }, $expr: { $eq: ['$trashRootId', '$_id'] } };
  const [cs, as] = await Promise.all([
    folders().find(filtro, { projection: { _id: 1 } }).toArray(),
    files().find(filtro, { projection: { _id: 1 } }).toArray()
  ]);
  const total = { archivos: 0, carpetas: 0, bytesLiberados: 0 };
  const pendientes = [...cs.map((c) => ['folder', c._id]), ...as.map((a) => ['file', a._id])];
  for (const [tipo, id] of pendientes) {
    // Puede haberse borrado ya como parte de una carpeta
    const recurso = await col(tipo === 'file' ? 'files' : 'folders').findOne({ _id: id });
    if (!recurso) continue;
    const r = await eliminarDefinitivo(req.user, tipo, recurso);
    total.archivos += r.archivos;
    total.carpetas += r.carpetas;
    total.bytesLiberados += r.bytesLiberados;
  }
  res.json({ ok: true, ...total });
});

export default router;
