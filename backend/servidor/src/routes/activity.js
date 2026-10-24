import { Router } from 'express';
import { col } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError, oid, parseRange, pagina, escapeRegex } from '../utils/http.js';
import { LEVEL, loadResource } from '../utils/access.js';

const router = Router();
router.use(authenticate);
const log = () => col('activity_log');

async function listar(filtro, query, res) {
  const { page, limit, skip } = pagina(query, 200);
  const [total, items] = await Promise.all([
    log().countDocuments(filtro),
    log().find(filtro).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray()
  ]);
  res.json({ total, page, limit, items });
}

// Admin: toda la actividad. Usuario: la que realizó + la realizada sobre sus recursos.
router.get('/', async (req, res) => {
  const { userId, action, resourceType, resourceId, desde, hasta, q } = req.query;
  const filtro = {};
  const y = [];
  if (req.user.rol !== 'admin') y.push({ $or: [{ userId: req.user._id }, { ownerId: req.user._id }] });
  // Búsqueda de texto: nombre del recurso o del usuario que actuó (sin distinguir mayúsculas)
  if (q) {
    const rx = { $regex: escapeRegex(String(q).slice(0, 120)), $options: 'i' };
    y.push({ $or: [{ resourceName: rx }, { userName: rx }] });
  }
  if (y.length) filtro.$and = y;
  if (userId) filtro.userId = oid(userId, 'userId');
  if (action) filtro.action = String(action);
  if (resourceType) filtro.resourceType = String(resourceType);
  if (resourceId) filtro.resourceId = oid(resourceId, 'resourceId');
  const rango = parseRange(desde, hasta);
  if (rango) filtro.timestamp = rango;
  await listar(filtro, req.query, res);
});

// Historial de un archivo o carpeta concretos (requiere al menos lectura sobre el recurso)
router.get('/resource/:tipo/:id', async (req, res) => {
  const { tipo } = req.params;
  if (!['file', 'folder'].includes(tipo)) throw new HttpError(400, 'Tipo inválido');
  const { recurso } = await loadResource(req.user, tipo, oid(req.params.id), LEVEL.read);
  await listar({ resourceType: tipo, resourceId: recurso._id }, req.query, res);
});

export default router;