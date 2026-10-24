import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { col } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../utils/http.js';
import { logActivity } from '../utils/activity.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string')
    throw new HttpError(400, 'Correo y contraseña son requeridos');

  const user = await col('users').findOne({ email: email.trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    throw new HttpError(401, 'Credenciales incorrectas');
  if (!user.activo) throw new HttpError(403, 'El usuario está inactivo');

  const token = jwt.sign({ sub: user._id.toString(), rol: user.rol }, config.jwtSecret, {
    expiresIn: '8h'
  });
  await logActivity(user, 'login', 'user', user);
  const { passwordHash, ...publico } = user;
  publico.almacenamientoAsignado ??= config.defaultQuotaBytes;
  res.json({ token, user: publico });
});

router.get('/me', authenticate, (req, res) => res.json(req.user));

export default router;
