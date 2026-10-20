import { Router } from 'express';
import { col } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError, oid, cleanName } from '../utils/http.js';
import { LEVEL, LEVEL_NAME, loadResource } from '../utils/access.js';
import { logActivity } from '../utils/activity.js';
import { nameTaken, reparentFolder } from '../utils/tree.js';

const router = Router();
router.use(authenticate);
const folders = () => col('folders');
const files = () => col('files');

// Lista plana de TODAS mis carpetas (útil para el selector "mover a...").
router.get('/', async (req, res) => {
  const lista = await folders()
    .find({ ownerId: req.user._id, deletedAt: null }, { projection: { nombre: 1, parentId: 1, ancestors: 1 } })
    .sort({ nombre: 1 })
    .toArray();
  res.json(lista);
});

// Contenido de una carpeta (o de la raíz si no se indica parentId).
// Las consultas normales siempre filtran deletedAt: null => la papelera no aparece.
router.get('/contents', async (req, res) => {
  const parentId = req.query.parentId ? oid(req.query.parentId, 'parentId') : null;
  let ownerId = req.user._id;
  let carpeta = null;
  let nivel = LEVEL.owner;
  let ruta = [];

  if (parentId) {
    const r = await loadResource(req.user, 'folder', parentId, LEVEL.read);
    carpeta = r.recurso;
    nivel = r.nivel;
    ownerId = carpeta.ownerId;
    if (nivel === LEVEL.owner && carpeta.ancestors.length) {
      const docs = await folders()
        .find({ _id: { $in: carpeta.ancestors } }, { projection: { nombre: 1 } })
        .toArray();
      ruta = carpeta.ancestors.map((a) => docs.find((d) => d._id.equals(a))).filter(Boolean);
    }
  }

  const [subcarpetas, archivos] = await Promise.all([
    folders().find({ ownerId, parentId, deletedAt: null }).sort({ nombre: 1 }).toArray(),
    files().find({ ownerId, folderId: parentId, deletedAt: null }, { projection: { gridFsId: 0 } })
      .sort({ nombre: 1 }).toArray()
  ]);
  res.json({ carpeta, nivel: LEVEL_NAME[nivel], ruta, carpetas: subcarpetas, archivos });
});

router.post('/', async (req, res) => {
  const nombre = cleanName(req.body?.nombre);
  const parentId = req.body?.parentId ? oid(req.body.parentId, 'parentId') : null;

  let ownerId = req.user._id;
  let ancestors = [];
  if (parentId) {
    // Con permiso de edición sobre el padre se puede crear dentro; el dueño sigue siendo el del padre.
    const { recurso: padre } = await loadResource(req.user, 'folder', parentId, LEVEL.edit);
    ownerId = padre.ownerId;
    ancestors = [...padre.ancestors, padre._id];
  }
  if (await nameTaken('folders', ownerId, 'parentId', parentId, nombre))
    throw new HttpError(409, 'Ya existe una carpeta con ese nombre en esta ubicación');

  const now = new Date();
  const doc = {
    nombre, ownerId, parentId, ancestors,
    createdAt: now, updatedAt: now,
    deletedAt: null, deletedBy: null, trashRootId: null
  };
  const { insertedId } = await folders().insertOne(doc);
  doc._id = insertedId;
  await logActivity(req.user, 'create_folder', 'folder', doc, { parentId });
  res.status(201).json(doc);
});

router.get('/:id', async (req, res) => {
  const { recurso, nivel } = await loadResource(req.user, 'folder', oid(req.params.id), LEVEL.read);
  res.json({ ...recurso, nivel: LEVEL_NAME[nivel] });
});

router.patch('/:id', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'folder', oid(req.params.id), LEVEL.edit);
  const nombre = cleanName(req.body?.nombre);
  if (await nameTaken('folders', recurso.ownerId, 'parentId', recurso.parentId, nombre, recurso._id))
    throw new HttpError(409, 'Ya existe una carpeta con ese nombre en esta ubicación');
  await folders().updateOne({ _id: recurso._id }, { $set: { nombre, updatedAt: new Date() } });
  await logActivity(req.user, 'rename', 'folder', { ...recurso, nombre }, { anterior: recurso.nombre });
  res.json({ ...recurso, nombre });
});

// Mover carpeta (solo dueño). Valida que no se cree un ciclo.
router.patch('/:id/move', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'folder', oid(req.params.id), LEVEL.owner);

  let destino = null;
  if (req.body?.parentId) {
    destino = await folders().findOne({
      _id: oid(req.body.parentId, 'parentId'),
      ownerId: req.user._id,
      deletedAt: null
    });
    if (!destino) throw new HttpError(404, 'Carpeta destino no encontrada');
    // Ciclo: destino es la misma carpeta o uno de sus descendientes
    if (destino._id.equals(recurso._id) || destino.ancestors.some((a) => a.equals(recurso._id)))
      throw new HttpError(400, 'No se puede mover una carpeta dentro de sí misma o de sus subcarpetas');
  }
  const nuevoPadreId = destino ? destino._id : null;
  if ((recurso.parentId?.toString() ?? null) === (nuevoPadreId?.toString() ?? null))
    throw new HttpError(400, 'La carpeta ya está en esa ubicación');
  if (await nameTaken('folders', recurso.ownerId, 'parentId', nuevoPadreId, recurso.nombre, recurso._id))
    throw new HttpError(409, 'Ya existe una carpeta con ese nombre en el destino');

  await reparentFolder(recurso, destino);
  await logActivity(req.user, 'move', 'folder', recurso, {
    desde: recurso.parentId, hacia: nuevoPadreId
  });
  res.json({ ok: true });
});

// Eliminar => papelera (en cascada). No se borra nada definitivamente aquí.
router.delete('/:id', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'folder', oid(req.params.id), LEVEL.owner);

  const descendientes = await folders()
    .find({ ancestors: recurso._id, deletedAt: null }, { projection: { _id: 1 } })
    .toArray();
  const ids = [recurso._id, ...descendientes.map((d) => d._id)];

  // trashRootId = carpeta que el usuario eliminó: agrupa la cascada para restaurarla de una vez.
  // Lo que ya estaba en la papelera por separado conserva su propio deletedAt/trashRootId.
  const marca = { deletedAt: new Date(), deletedBy: req.user._id, trashRootId: recurso._id };
  await folders().updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: marca });
  const r = await files().updateMany({ folderId: { $in: ids }, deletedAt: null }, { $set: marca });

  await logActivity(req.user, 'trash', 'folder', recurso, {
    carpetas: ids.length, archivos: r.modifiedCount
  });
  res.json({ ok: true, carpetas: ids.length, archivos: r.modifiedCount });
});

export default router;
