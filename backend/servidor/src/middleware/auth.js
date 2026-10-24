import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { config } from '../config.js';
import { col } from '../db.js';
import { HttpError } from '../utils/http.js';

// Valida el JWT y recarga al usuario: así un usuario desactivado pierde acceso de inmediato.
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Token requerido');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Token inválido o expirado');
  }

  const user = await col('users').findOne(
      { _id: new ObjectId(payload.sub) },
      { projection: { passwordHash: 0 } }
  );
  if (!user || !user.activo) throw new HttpError(401, 'Usuario inexistente o inactivo');
  // Los usuarios sin cuota guardada reciben la cuota por defecto
  req.user = { ...user, almacenamientoAsignado: user.almacenamientoAsignado ?? config.defaultQuotaBytes };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin') throw new HttpError(403, 'Se requiere rol de administrador');
  next();
}
