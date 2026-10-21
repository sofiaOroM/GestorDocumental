import { Router } from 'express';
import { col } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError, oid } from '../utils/http.js';
import { LEVEL, loadResource } from '../utils/access.js';
import { logActivity } from '../utils/activity.js';
import { sharesPipeline } from '../utils/sharesQuery.js';

const router = Router();
router.use(authenticate);
const shares = () => col('shares');
const PERMISOS = ['read', 'comment', 'edit'];
const TIPOS = ['file', 'folder'];

// Compartir (o actualizar el permiso si ya estaba compartido con ese usuario). Solo el dueño.
router.post('/', async (req, res) => {
  const { resourceType, resourceId, permission, email, userId } = req.body || {};
  if (!TIPOS.includes(resourceType)) throw new HttpError(400, 'resourceType debe ser "file" o "folder"');
  if (!PERMISOS.includes(permission)) throw new HttpError(400, 'permission debe ser read, comment o edit');

  const { recurso } = await loadResource(req.user, resourceType, oid(resourceId, 'resourceId'), LEVEL.owner);

  const destinatario = userId
    ? await col('users').findOne({ _id: oid(userId, 'userId') })
    : await col('users').findOne({ email: String(email || '').trim().toLowerCase() });
  if (!destinatario || !destinatario.activo)
    throw new HttpError(404, 'Usuario destino no encontrado o inactivo');
  if (destinatario._id.equals(req.user._id)) throw new HttpError(400, 'No puedes compartir contigo mismo');

  const filtro = { resourceType, resourceId: recurso._id, sharedWithId: destinatario._id };
  const previo = await shares().findOne(filtro);
  const detalles = { sharedWith: destinatario.nombre, sharedWithId: destinatario._id, permission };

  if (previo) {
    await shares().updateOne({ _id: previo._id }, { $set: { permission, updatedAt: new Date() } });
    await logActivity(req.user, 'share_update', resourceType, recurso, { ...detalles, anterior: previo.permission });
    return res.json({ ...previo, permission });
  }
  const doc = { ...filtro, ownerId: recurso.ownerId, permission, createdAt: new Date() };
  const { insertedId } = await shares().insertOne(doc);
  await logActivity(req.user, 'share', resourceType, recurso, detalles);
  res.status(201).json({ ...doc, _id: insertedId });
});

// Recursos que YO compartí
router.get('/sent', async (req, res) => {
  res.json(await shares().aggregate(sharesPipeline({ ownerId: req.user._id })).toArray());
});

// Recursos que ME compartieron
router.get('/received', async (req, res) => {
  res.json(await shares().aggregate(sharesPipeline({ sharedWithId: req.user._id })).toArray());
});

// Con quién está compartido un recurso (solo dueño)
router.get('/resource/:tipo/:id', async (req, res) => {
  const tipo = req.params.tipo;
  if (!TIPOS.includes(tipo)) throw new HttpError(400, 'Tipo inválido');
  const { recurso } = await loadResource(req.user, tipo, oid(req.params.id), LEVEL.owner);
  res.json(await shares().aggregate(sharesPipeline({ resourceType: tipo, resourceId: recurso._id })).toArray());
});

async function cargarShareDelDueno(req) {
  const share = await shares().findOne({ _id: oid(req.params.id) });
  if (!share) throw new HttpError(404, 'Registro de compartición no encontrado');
  if (!share.ownerId.equals(req.user._id))
    throw new HttpError(403, 'Solo el propietario puede modificar los permisos');
  const coleccion = share.resourceType === 'file' ? 'files' : 'folders';
  const recurso =
    (await col(coleccion).findOne({ _id: share.resourceId })) ||
    { _id: share.resourceId, nombre: '(eliminado)', ownerId: share.ownerId };
  return { share, recurso };
}

// Modificar nivel de acceso
router.patch('/:id', async (req, res) => {
  const { share, recurso } = await cargarShareDelDueno(req);
  const { permission } = req.body || {};
  if (!PERMISOS.includes(permission)) throw new HttpError(400, 'permission debe ser read, comment o edit');
  await shares().updateOne({ _id: share._id }, { $set: { permission, updatedAt: new Date() } });
  await logActivity(req.user, 'share_update', share.resourceType, recurso, {
    sharedWithId: share.sharedWithId, permission, anterior: share.permission
  });
  res.json({ ...share, permission });
});

// Retirar acceso
router.delete('/:id', async (req, res) => {
  const { share, recurso } = await cargarShareDelDueno(req);
  await shares().deleteOne({ _id: share._id });
  await logActivity(req.user, 'unshare', share.resourceType, recurso, {
    sharedWithId: share.sharedWithId, permission: share.permission
  });
  res.json({ ok: true });
});

export default router;
