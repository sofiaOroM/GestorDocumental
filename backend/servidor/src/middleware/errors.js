import { HttpError } from '../utils/http.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  // Errores del analizador de JSON (cuerpo mal formado o demasiado grande)
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido' });
  if (err.type === 'entity.too.large')
    return res.status(413).json({ error: 'El cuerpo de la solicitud es demasiado grande' });
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'El registro ya existe' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
