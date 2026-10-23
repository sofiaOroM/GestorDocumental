// Validaciones del cliente. Cada función devuelve el mensaje de error, o null si el valor es válido.
// El servidor vuelve a validar todo: estas reglas existen para dar una respuesta inmediata al usuario.

export const MAX_NOMBRE = 120;
export const CARACTERES_INVALIDOS = '\\ / : * ? " < > |';

const INVALIDOS = /[\\/:*?"<>|]/;
const NOMBRE_PERSONA = /^\p{L}+(?:[ '’-]\p{L}+)*$/u; // letras (con tildes y ñ), separadas por espacio, ' o -

/** Nombre de carpeta o archivo (puede llevar números y guiones). */
export function validarNombreRecurso(valor: string, tipo: 'carpeta' | 'archivo'): string | null {
    const v = valor.trim();
    if (!v) return 'El nombre es obligatorio.';
    if (v.length > MAX_NOMBRE) return `Máximo ${MAX_NOMBRE} caracteres.`;
    if (INVALIDOS.test(v)) return `No puede contener los caracteres ${CARACTERES_INVALIDOS}`;
    if (v === '.' || v === '..') return 'Ese nombre no es válido.';
    if (tipo === 'archivo' && !/\.(txt|md)$/i.test(v)) return 'El nombre debe terminar en .txt o .md.';
    return null;
}

/** Nombre de una persona: solo letras y espacios (sin números ni símbolos). */
export function validarNombrePersona(valor: string): string | null {
    const v = valor.trim();
    if (!v) return 'El nombre es obligatorio.';
    if (v.length < 2) return 'Escribe al menos 2 letras.';
    if (v.length > 60) return 'Máximo 60 caracteres.';
    if (!NOMBRE_PERSONA.test(v)) return 'Solo puede contener letras y espacios (sin números ni símbolos).';
    return null;
}

export function validarEmail(valor: string): string | null {
    const v = valor.trim();
    if (!v) return 'El correo es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    return null;
}

export const MIN_PASSWORD = 8;
export const faltanCaracteres = (p: string) => Math.max(0, MIN_PASSWORD - p.length);

export function reglasPassword(p: string): { texto: string; ok: boolean }[] {
    return [
        { texto: `Al menos ${MIN_PASSWORD} caracteres`, ok: p.length >= MIN_PASSWORD },
        { texto: 'Al menos una letra', ok: /\p{L}/u.test(p) },
        { texto: 'Al menos un número', ok: /\d/.test(p) }
    ];
}
export const passwordValida = (p: string) => reglasPassword(p).every((r) => r.ok);

/** Archivo elegido para subir: tipo y nombre. No hay límite de tamaño. */
export function validarArchivoSubida(f: File): string | null {
    if (!/\.(txt|md)$/i.test(f.name)) return 'solo se permiten archivos .txt y .md';
    const e = validarNombreRecurso(f.name, 'archivo');
    if (e) return e.charAt(0).toLowerCase() + e.slice(1);
    return null;
}

/** Rango de fechas (YYYY-MM-DD): "desde" no puede ser posterior a "hasta". */
export const rangoInvalido = (desde: string, hasta: string) => !!desde && !!hasta && desde > hasta;