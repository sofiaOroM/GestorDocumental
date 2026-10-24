import { Router } from 'express';
import { col } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError, oid, parseRange } from '../utils/http.js';
import { sharesPipeline } from '../utils/sharesQuery.js';

const router = Router();
router.use(authenticate);

const TZ = 'America/Guatemala';
// Alcance: el admin ve datos globales; un usuario solo los suyos.
const ownerScope = (u) => (u.rol === 'admin' ? {} : { ownerId: u._id });
const activityScope = (u) =>
    u.rol === 'admin' ? {} : { $or: [{ userId: u._id }, { ownerId: u._id }] };
const limite = (q, def = 10) => Math.min(100, Math.max(1, Number(q.limit) || def));

function usuarioObjetivo(req) {
  const id = req.query.userId ? oid(req.query.userId, 'userId') : req.user._id;
  if (req.user.rol !== 'admin' && !id.equals(req.user._id))
    throw new HttpError(403, 'Solo un administrador puede consultar a otros usuarios');
  return id;
}

// ============ Archivos y almacenamiento ============

// Cantidad de archivos agrupados por tipo
router.get('/archivos-por-tipo', async (req, res) => {
  res.json(await col('files').aggregate([
    { $match: { ...ownerScope(req.user), deletedAt: null } },
    { $group: { _id: '$extension', cantidad: { $sum: 1 }, tamanoTotal: { $sum: '$size' } } },
    { $sort: { cantidad: -1 } },
    { $project: { _id: 0, tipo: '$_id', cantidad: 1, tamanoTotal: 1 } }
  ]).toArray());
});

// Archivos almacenados dentro de un rango de fechas (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD)
router.get('/archivos-por-fecha', async (req, res) => {
  const rango = parseRange(req.query.desde, req.query.hasta);
  const match = { ...ownerScope(req.user), deletedAt: null };
  if (rango) match.createdAt = rango;
  res.json(await col('files').aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: 500 },
    { $lookup: { from: 'users', localField: 'ownerId', foreignField: '_id', as: 'propietario' } },
    { $project: {
        nombre: 1, extension: 1, size: 1, createdAt: 1,
        propietario: { $arrayElemAt: ['$propietario.nombre', 0] } } }
  ]).toArray());
});

// Archivos con mayor cantidad de operaciones registradas
router.get('/archivos-mas-operaciones', async (req, res) => {
  res.json(await col('activity_log').aggregate([
    { $match: { ...activityScope(req.user), resourceType: 'file' } },
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$resourceId', operaciones: { $sum: 1 }, nombre: { $first: '$resourceName' },
        ultima: { $first: '$timestamp' } } },
    { $sort: { operaciones: -1 } },
    { $limit: limite(req.query) },
    { $lookup: { from: 'files', localField: '_id', foreignField: '_id', as: 'f' } },
    { $project: { _id: 0, archivoId: '$_id', nombre: 1, operaciones: 1, ultima: 1,
        existe: { $gt: [{ $size: '$f' }, 0] } } }
  ]).toArray());
});

// Carpetas con mayor cantidad de archivos (archivos directos de cada carpeta, sin contar la papelera)
router.get('/carpetas-mas-archivos', async (req, res) => {
  res.json(await col('files').aggregate([
    { $match: { ...ownerScope(req.user), deletedAt: null, folderId: { $ne: null } } },
    { $group: { _id: '$folderId', archivos: { $sum: 1 }, tamanoTotal: { $sum: '$size' } } },
    { $lookup: { from: 'folders', localField: '_id', foreignField: '_id', as: 'c' } },
    { $match: { 'c.0': { $exists: true }, 'c.deletedAt': null } },
    { $sort: { archivos: -1 } },
    { $limit: limite(req.query) },
    { $lookup: { from: 'users', localField: 'c.ownerId', foreignField: '_id', as: 'u' } },
    { $project: { _id: 0, carpetaId: '$_id', nombre: { $arrayElemAt: ['$c.nombre', 0] },
        propietario: { $arrayElemAt: ['$u.nombre', 0] }, archivos: 1, tamanoTotal: 1 } }
  ]).toArray());
});

// ============ Usuarios (solo admin) ============

// Top 10 usuarios con mayor cantidad de archivos almacenados
router.get('/usuarios-top-archivos', requireAdmin, async (req, res) => {
  res.json(await col('files').aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: '$ownerId', archivos: { $sum: 1 }, tamanoTotal: { $sum: '$size' } } },
    { $sort: { archivos: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $project: { _id: 0, userId: '$_id', nombre: { $arrayElemAt: ['$u.nombre', 0] },
        email: { $arrayElemAt: ['$u.email', 0] }, archivos: 1, tamanoTotal: 1 } }
  ]).toArray());
});

// Usuarios con mayor cantidad de recursos compartidos
router.get('/usuarios-mas-compartidos', requireAdmin, async (req, res) => {
  res.json(await col('shares').aggregate([
    { $group: {
        _id: '$ownerId',
        totalCompartidos: { $sum: 1 },
        archivos: { $sum: { $cond: [{ $eq: ['$resourceType', 'file'] }, 1, 0] } },
        carpetas: { $sum: { $cond: [{ $eq: ['$resourceType', 'folder'] }, 1, 0] } },
        recursosDistintos: { $addToSet: '$resourceId' } } },
    { $sort: { totalCompartidos: -1 } },
    { $limit: limite(req.query) },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $project: { _id: 0, userId: '$_id', nombre: { $arrayElemAt: ['$u.nombre', 0] },
        totalCompartidos: 1, archivos: 1, carpetas: 1,
        recursosDistintos: { $size: '$recursosDistintos' } } }
  ]).toArray());
});

// ============ Compartición ============

// Archivos compartidos con mayor cantidad de usuarios
router.get('/archivos-mas-compartidos', async (req, res) => {
  res.json(await col('shares').aggregate([
    { $match: { ...ownerScope(req.user), resourceType: 'file' } },
    { $group: { _id: '$resourceId', usuarios: { $sum: 1 } } },
    { $lookup: { from: 'files', localField: '_id', foreignField: '_id', as: 'f' } },
    { $match: { 'f.0': { $exists: true }, 'f.deletedAt': null } },
    { $sort: { usuarios: -1 } },
    { $limit: limite(req.query) },
    { $project: { _id: 0, archivoId: '$_id', nombre: { $arrayElemAt: ['$f.nombre', 0] }, usuarios: 1 } }
  ]).toArray());
});

// Archivos que nunca han sido compartidos: sin comparticiones vigentes y sin ningún evento "share" en el historial
// (así un archivo compartido y luego revocado NO cuenta como "nunca compartido").
router.get('/archivos-nunca-compartidos', async (req, res) => {
  res.json(await col('files').aggregate([
    { $match: { ...ownerScope(req.user), deletedAt: null } },
    { $lookup: { from: 'shares', localField: '_id', foreignField: 'resourceId', as: 'vigentes' } },
    { $match: { vigentes: { $size: 0 } } },
    { $lookup: {
        from: 'activity_log',
        let: { id: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$resourceId', '$$id'] }, { $eq: ['$action', 'share'] }] } } },
          { $limit: 1 }
        ],
        as: 'historial' } },
    { $match: { historial: { $size: 0 } } },
    { $sort: { createdAt: -1 } },
    { $limit: 500 },
    { $lookup: { from: 'users', localField: 'ownerId', foreignField: '_id', as: 'u' } },
    { $project: { nombre: 1, extension: 1, size: 1, createdAt: 1, propietario: { $arrayElemAt: ['$u.nombre', 0] } } }
  ]).toArray());
});

// Recursos compartidos por un usuario seleccionado (?userId=)
router.get('/compartidos-por', async (req, res) => {
  const id = usuarioObjetivo(req);
  res.json(await col('shares').aggregate(sharesPipeline({ ownerId: id })).toArray());
});

// Recursos recibidos por un usuario seleccionado (?userId=)
router.get('/recibidos-por', async (req, res) => {
  const id = usuarioObjetivo(req);
  res.json(await col('shares').aggregate(sharesPipeline({ sharedWithId: id })).toArray());
});

// ============ Actividad ============

// Historial de actividad de un usuario dentro de un rango de fechas
router.get('/actividad-usuario', async (req, res) => {
  const id = usuarioObjetivo(req);
  const match = { userId: id };
  const rango = parseRange(req.query.desde, req.query.hasta);
  if (rango) match.timestamp = rango;
  res.json(await col('activity_log').aggregate([
    { $match: match },
    { $sort: { timestamp: -1 } },
    { $limit: 500 },
    { $project: { action: 1, resourceType: 1, resourceName: 1, resourceId: 1, details: 1, timestamp: 1 } }
  ]).toArray());
});

function matchActividad(req) {
  const match = { ...activityScope(req.user) };
  const rango = parseRange(req.query.desde, req.query.hasta);
  if (rango) match.timestamp = rango;
  return match;
}

// Cantidad de operaciones agrupadas por tipo
router.get('/operaciones-por-tipo', async (req, res) => {
  res.json(await col('activity_log').aggregate([
    { $match: matchActividad(req) },
    { $group: { _id: '$action', cantidad: { $sum: 1 } } },
    { $sort: { cantidad: -1 } },
    { $project: { _id: 0, accion: '$_id', cantidad: 1 } }
  ]).toArray());
});

// Cantidad de operaciones agrupadas por período (?granularidad=hora|dia|mes)
router.get('/operaciones-por-periodo', async (req, res) => {
  const formatos = { hora: '%Y-%m-%d %H:00', dia: '%Y-%m-%d', mes: '%Y-%m' };
  const formato = formatos[req.query.granularidad || 'dia'];
  if (!formato) throw new HttpError(400, 'granularidad debe ser hora, dia o mes');
  res.json(await col('activity_log').aggregate([
    { $match: matchActividad(req) },
    { $group: { _id: { $dateToString: { format: formato, date: '$timestamp', timezone: TZ } },
        cantidad: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, periodo: '$_id', cantidad: 1 } }
  ]).toArray());
});

// Principales acciones realizadas (acción + tipo de recurso)
router.get('/principales-acciones', async (req, res) => {
  res.json(await col('activity_log').aggregate([
    { $match: matchActividad(req) },
    { $group: { _id: { accion: '$action', recurso: '$resourceType' }, cantidad: { $sum: 1 },
        usuarios: { $addToSet: '$userId' } } },
    { $sort: { cantidad: -1 } },
    { $limit: limite(req.query) },
    { $project: { _id: 0, accion: '$_id.accion', recurso: '$_id.recurso', cantidad: 1,
        usuariosDistintos: { $size: '$usuarios' } } }
  ]).toArray());
});

export default router;