import { ObjectId } from 'mongodb';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const EXTENSIONES = ['txt', 'md'];
export const MIME = { txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8' };

export function oid(valor, campo = 'id') {
  if (typeof valor !== 'string' || !/^[a-f0-9]{24}$/i.test(valor))
    throw new HttpError(400, `${campo} inválido`);
  return new ObjectId(valor);
}

export function cleanName(valor, campo = 'nombre') {
  if (typeof valor !== 'string') throw new HttpError(400, `${campo} es requerido`);
  const n = valor.trim();
  if (!n || n.length > 120) throw new HttpError(400, `${campo} debe tener entre 1 y 120 caracteres`);
  if (/[\\/:*?"<>|]/.test(n) || n === '.' || n === '..')
    throw new HttpError(400, `${campo} contiene caracteres no permitidos`);
  return n;
}

export function getExt(nombre) {
  const ext = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
  if (!EXTENSIONES.includes(ext)) throw new HttpError(400, 'Solo se permiten archivos .txt y .md');
  return ext;
}

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Guatemala está en UTC-6 todo el año (sin horario de verano).
const TZ = '-06:00';

// Convierte ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD en {$gte,$lte} (días completos).
export function parseRange(desde, hasta) {
  const r = {};
  const parse = (v, fin, nombre) => {
    const d = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${fin ? '23:59:59.999' : '00:00:00.000'}${TZ}` : v
    );
    if (isNaN(d)) throw new HttpError(400, `Fecha "${nombre}" inválida`);
    return d;
  };
  if (desde) r.$gte = parse(desde, false, 'desde');
  if (hasta) r.$lte = parse(hasta, true, 'hasta');
  return Object.keys(r).length ? r : null;
}

export function pagina(query, maxLimit = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
