import { col } from '../db.js';
import { config } from '../config.js';
import { HttpError } from './http.js';

export const MB = 1024 * 1024;

// Espacio asignado a un usuario (los usuarios antiguos sin el campo reciben la cuota por defecto)
export const cuotaDe = (u) => u.almacenamientoAsignado ?? config.defaultQuotaBytes;
export const conCuota = (u) => ({ ...u, almacenamientoAsignado: cuotaDe(u) });

// Convierte una cuota recibida en MB a bytes, validándola
export function parseCuotaMB(valor) {
    const mb = Number(valor);
    if (!Number.isFinite(mb) || mb <= 0 || mb > 1_000_000)
        throw new HttpError(400, 'La cuota debe ser un número de MB mayor que 0');
    return Math.round(mb * MB);
}

const fmt = (bytes) => `${(bytes / MB).toFixed(2)} MB`;

// Rechaza la operación si el propietario no tiene espacio disponible para 'bytesNuevos'.
// disponible = asignado - utilizado
export async function verificarEspacio(ownerId, bytesNuevos, esPropio = true) {
    if (bytesNuevos <= 0) return;
    const dueno = await col('users').findOne(
        { _id: ownerId },
        { projection: { almacenamientoUsado: 1, almacenamientoAsignado: 1 } }
    );
    const disponible = cuotaDe(dueno ?? {}) - (dueno?.almacenamientoUsado ?? 0);
    if (bytesNuevos > disponible) {
        throw new HttpError(
            413,
            esPropio
                ? `Espacio de almacenamiento insuficiente: disponible ${fmt(Math.max(0, disponible))}, se necesitan ${fmt(bytesNuevos)}.`
                : 'El propietario de la carpeta no tiene espacio de almacenamiento suficiente.'
        );
    }
}