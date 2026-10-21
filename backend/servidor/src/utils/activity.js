import { col } from '../db.js';

// Registra una operación. Se guarda una copia del nombre del recurso (resourceName)
// para que el historial siga siendo legible aunque el recurso se elimine definitivamente.
export async function logActivity(user, action, resourceType, recurso, details = {}) {
  await col('activity_log').insertOne({
    userId: user._id,
    userName: user.nombre,
    ownerId: recurso.ownerId ?? user._id,
    action,
    resourceType,
    resourceId: recurso._id,
    resourceName: recurso.nombre,
    details,
    timestamp: new Date()
  });
}
