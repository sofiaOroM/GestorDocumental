import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { col } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError, oid, cleanName } from '../utils/http.js';
import { logActivity } from '../utils/activity.js';

const router = Router();
router.use(authenticate);

// Directorio para elegir con quién compartir (cualquier usuario autenticado).
router.get('/directory', async (req, res) => {
  const lista = await col('users')
    .find({ activo: true, _id: { $ne: req.user._id } }, { projection: { nombre: 1, email: 1 } })
    .sort({ nombre: 1 })
    .toArray();
  res.json(lista);
});

// ---- Administración de usuarios (solo admin) ----
router.use(requireAdmin);

router.get('/', async (req, res) => {
  const lista = await col('users')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ nombre: 1 })
    .toArray();
  res.json(lista);
});

router.post('/', async (req, res) => {
  const { email, password, rol = 'user' } = req.body || {};
  const nombre = cleanName(req.body?.nombre);
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email))
    throw new HttpError(400, 'Correo inválido');
  if (typeof password !== 'string' || password.length < 8)
    throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  if (!['admin', 'user'].includes(rol)) throw new HttpError(400, 'Rol inválido');

  const doc = {
    nombre,
    email: email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    rol,
    activo: true,
    almacenamientoUsado: 0,
    createdAt: new Date()
  };
  const { insertedId } = await col('users').insertOne(doc); // 11000 => 409 por índice único
  await logActivity(req.user, 'create_user', 'user', { _id: insertedId, nombre });
  const { passwordHash, ...publico } = { ...doc, _id: insertedId };
  res.status(201).json(publico);
});

// Editar nombre, rol, estado (activar/desactivar) o contraseña.
// Desactivar NO elimina nada: archivos, carpetas e historial se conservan.
router.patch('/:id', async (req, res) => {
  const id = oid(req.params.id);
  const user = await col('users').findOne({ _id: id });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');

  const { rol, activo, password } = req.body || {};
  const set = {};
  if (req.body?.nombre !== undefined) set.nombre = cleanName(req.body.nombre);
  if (rol !== undefined) {
    if (!['admin', 'user'].includes(rol)) throw new HttpError(400, 'Rol inválido');
    set.rol = rol;
  }
  if (activo !== undefined) set.activo = Boolean(activo);
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8)
      throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
    set.passwordHash = await bcrypt.hash(password, 10);
  }
  if (id.equals(req.user._id) && (set.activo === false || (set.rol && set.rol !== 'admin')))
    throw new HttpError(400, 'No puedes desactivarte ni quitarte el rol de administrador');
  if (!Object.keys(set).length) throw new HttpError(400, 'Nada que actualizar');

  await col('users').updateOne({ _id: id }, { $set: set });
  const campos = Object.keys(set).filter((k) => k !== 'passwordHash');
  await logActivity(req.user, 'update_user', 'user', user, { campos });
  const actualizado = await col('users').findOne({ _id: id }, { projection: { passwordHash: 0 } });
  res.json(actualizado);
});

export default router;
