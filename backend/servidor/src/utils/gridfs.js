import { getBucket } from '../db.js';

// Guarda un Buffer en GridFS y devuelve el _id del contenido.
export function saveContent(buffer, filename, metadata = {}) {
  return new Promise((resolve, reject) => {
    const up = getBucket().openUploadStream(filename, { metadata });
    up.on('error', reject);
    up.on('finish', () => resolve(up.id));
    up.end(buffer);
  });
}

// Elimina el contenido; si ya no existe, no es error.
export async function deleteContent(id) {
  try {
    await getBucket().delete(id);
  } catch (e) {
    if (!/not found/i.test(e.message)) throw e;
  }
}
