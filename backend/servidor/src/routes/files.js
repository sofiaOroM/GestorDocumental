import { Router } from 'express';
import multer from 'multer';
import { col, getBucket } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import {
  HttpError, oid, cleanName, getExt, MIME, EXTENSIONES, escapeRegex, parseRange, pagina
} from '../utils/http.js';
import { LEVEL, LEVEL_NAME, loadResource } from '../utils/access.js';
import { logActivity } from '../utils/activity.js';
import { saveContent, deleteContent } from '../utils/gridfs.js';
import { nameTaken } from '../utils/tree.js';

const router = Router();
router.use(authenticate);
const files = () => col('files');

/*const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileBytes, files: 1 }
});*/

// Sin límite de tamaño, salvo que se defina MAX_FILE_MB en el .env
const limites = { files: 1 };
if (config.maxFileBytes) limites.fileSize = config.maxFileBytes;
const upload = multer({ storage: multer.memoryStorage(), limits: limites });


// Los nombres con tildes llegan como latin1; se reconvierten a UTF-8.
const fixName = (n) => (/[^\x00-\xff]/.test(n) ? n : Buffer.from(n, 'latin1').toString('utf8'));
const sinContenido = { projection: { gridFsId: 0 } };

// ---- Búsqueda / filtros / ordenamiento sobre los propios archivos ----
router.get('/', async (req, res) => {
  const { q, extension, folderId, desde, hasta, minSize, maxSize, sort = 'createdAt', order = 'desc' } = req.query;
  const { page, limit, skip } = pagina(req.query);

  const filtro = { ownerId: req.user._id, deletedAt: null };
  if (q) filtro.nombre = { $regex: escapeRegex(q), $options: 'i' };
  if (extension) {
    if (!EXTENSIONES.includes(extension)) throw new HttpError(400, 'Extensión inválida');
    filtro.extension = extension;
  }
  if (folderId) filtro.folderId = folderId === 'root' ? null : oid(folderId, 'folderId');
  const rango = parseRange(desde, hasta);
  if (rango) filtro.createdAt = rango;
  if (minSize || maxSize) {
    filtro.size = {};
    if (minSize) filtro.size.$gte = Number(minSize);
    if (maxSize) filtro.size.$lte = Number(maxSize);
  }
  const permitidos = ['nombre', 'size', 'createdAt', 'updatedAt', 'extension'];
  const orden = { [permitidos.includes(sort) ? sort : 'createdAt']: order === 'asc' ? 1 : -1 };

  const [total, items] = await Promise.all([
    files().countDocuments(filtro),
    files().find(filtro, sinContenido).sort(orden).skip(skip).limit(limit).toArray()
  ]);
  res.json({ total, page, limit, items });
});

// ---- Subir archivo (multipart: campo "archivo" + folderId opcional) ----
router.post('/', upload.single('archivo'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Debes enviar un archivo en el campo "archivo"');
  const nombre = cleanName(fixName(req.file.originalname));
  const extension = getExt(nombre);
  const folderId = req.body?.folderId ? oid(req.body.folderId, 'folderId') : null;

  let ownerId = req.user._id;
  if (folderId) {
    const { recurso: carpeta } = await loadResource(req.user, 'folder', folderId, LEVEL.edit);
    ownerId = carpeta.ownerId; // el espacio se descuenta del dueño de la carpeta
  }
  if (await nameTaken('files', ownerId, 'folderId', folderId, nombre))
    throw new HttpError(409, 'Ya existe un archivo con ese nombre en esta carpeta');

  const size = req.file.buffer.length;
  const gridFsId = await saveContent(req.file.buffer, nombre, { ownerId });
  const now = new Date();
  const doc = {
    nombre, extension, mimeType: MIME[extension], size,
    ownerId, folderId, gridFsId,
    createdAt: now, updatedAt: now,
    deletedAt: null, deletedBy: null, trashRootId: null
  };
  try {
    const { insertedId } = await files().insertOne(doc);
    doc._id = insertedId;
  } catch (e) {
    await deleteContent(gridFsId); // no dejar contenido huérfano
    throw e;
  }
  await col('users').updateOne({ _id: ownerId }, { $inc: { almacenamientoUsado: size } });
  await logActivity(req.user, 'upload', 'file', doc, { size, folderId });

  const { gridFsId: _g, ...publico } = doc;
  res.status(201).json(publico);
});

router.get('/:id', async (req, res) => {
  const { recurso, nivel } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.read);
  const { gridFsId, ...publico } = recurso;
  res.json({ ...publico, nivel: LEVEL_NAME[nivel] });
});

// Descarga (o vista previa con ?inline=1). El contenido sale de GridFS.
router.get('/:id/download', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.read);
  const inline = req.query.inline === '1';
  res.set({
    'Content-Type': MIME[recurso.extension],
    'Content-Length': recurso.size,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(recurso.nombre)}`
  });
  await logActivity(req.user, inline ? 'view' : 'download', 'file', recurso);

  const stream = getBucket().openDownloadStream(recurso.gridFsId);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'No se pudo leer el contenido' });
    else res.destroy();
  });
  stream.pipe(res);
});

// Reemplazar contenido (permiso de edición).
router.put('/:id/content', upload.single('archivo'), async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.edit);
  if (!req.file) throw new HttpError(400, 'Debes enviar un archivo en el campo "archivo"');

  const size = req.file.buffer.length;
  const nuevoId = await saveContent(req.file.buffer, recurso.nombre, { ownerId: recurso.ownerId });
  await files().updateOne(
    { _id: recurso._id },
    { $set: { gridFsId: nuevoId, size, updatedAt: new Date() } }
  );
  await deleteContent(recurso.gridFsId);
  await col('users').updateOne(
    { _id: recurso.ownerId },
    { $inc: { almacenamientoUsado: size - recurso.size } }
  );
  await logActivity(req.user, 'edit', 'file', recurso, { size });
  res.json({ ok: true, size });
});

router.patch('/:id', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.edit);
  const nombre = cleanName(req.body?.nombre);
  const extension = getExt(nombre);
  if (await nameTaken('files', recurso.ownerId, 'folderId', recurso.folderId ?? null, nombre, recurso._id))
    throw new HttpError(409, 'Ya existe un archivo con ese nombre en esta carpeta');

  await files().updateOne(
    { _id: recurso._id },
    { $set: { nombre, extension, mimeType: MIME[extension], updatedAt: new Date() } }
  );
  await logActivity(req.user, 'rename', 'file', { ...recurso, nombre }, { anterior: recurso.nombre });
  res.json({ ok: true, nombre, extension });
});

// Mover archivo (solo dueño) a una carpeta propia o a la raíz (folderId = null).
router.patch('/:id/move', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.owner);

  let destino = null;
  if (req.body?.folderId) {
    destino = await col('folders').findOne({
      _id: oid(req.body.folderId, 'folderId'),
      ownerId: req.user._id,
      deletedAt: null
    });
    if (!destino) throw new HttpError(404, 'Carpeta destino no encontrada');
  }
  const folderId = destino ? destino._id : null;
  if ((recurso.folderId?.toString() ?? null) === (folderId?.toString() ?? null))
    throw new HttpError(400, 'El archivo ya está en esa ubicación');
  if (await nameTaken('files', recurso.ownerId, 'folderId', folderId, recurso.nombre, recurso._id))
    throw new HttpError(409, 'Ya existe un archivo con ese nombre en el destino');

  await files().updateOne({ _id: recurso._id }, { $set: { folderId, updatedAt: new Date() } });
  await logActivity(req.user, 'move', 'file', recurso, { desde: recurso.folderId ?? null, hacia: folderId });
  res.json({ ok: true });
});

// Eliminar => papelera (solo dueño).
router.delete('/:id', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.owner);
  await files().updateOne(
    { _id: recurso._id },
    { $set: { deletedAt: new Date(), deletedBy: req.user._id, trashRootId: recurso._id } }
  );
  await logActivity(req.user, 'trash', 'file', recurso);
  res.json({ ok: true });
});

// ---- Comentarios (permiso "comment" o superior) ----
router.get('/:id/comments', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.read);
  res.json(await col('comments').find({ fileId: recurso._id }).sort({ createdAt: 1 }).toArray());
});

router.post('/:id/comments', async (req, res) => {
  const { recurso } = await loadResource(req.user, 'file', oid(req.params.id), LEVEL.comment);
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto || texto.length > 1000) throw new HttpError(400, 'El comentario debe tener entre 1 y 1000 caracteres');
  const doc = {
    fileId: recurso._id, userId: req.user._id, userName: req.user.nombre, texto, createdAt: new Date()
  };
  const { insertedId } = await col('comments').insertOne(doc);
  await logActivity(req.user, 'comment', 'file', recurso);
  res.status(201).json({ ...doc, _id: insertedId });
});

export default router;
