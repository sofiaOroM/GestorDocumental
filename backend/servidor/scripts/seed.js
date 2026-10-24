// Carga inicial: BORRA la base de datos configurada y la vuelve a crear con datos de demostración.
// Uso: npm run seed
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { config } from '../src/config.js';
import { connectDB, closeDB, createIndexes, col } from '../src/db.js';
import { saveContent } from '../src/utils/gridfs.js';

// Generador pseudoaleatorio con semilla fija => la carga es reproducible
let semilla = 42;
const rnd = () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const DIA = 86400000;
const ahora = Date.now();
const haceDias = (n) => new Date(ahora - rnd() * n * DIA);
const despuesDe = (fecha) => new Date(fecha.getTime() + rnd() * (ahora - fecha.getTime()));

const db = await connectDB(config.mongoUri, config.dbName);
await db.dropDatabase();
await createIndexes();

// ---------- Usuarios ----------
const PASSWORD = 'Password123!';
const passwordHash = await bcrypt.hash(PASSWORD, 10);
const usuarios = [
  { nombre: 'Administrador General', email: 'admin@docs.com', rol: 'admin' },
  { nombre: 'Ana López', email: 'ana@docs.com', rol: 'user' },
  { nombre: 'Luis Pérez', email: 'luis@docs.com', rol: 'user' }
].map((u, i) => ({
  _id: new ObjectId(), ...u, passwordHash, activo: true, almacenamientoUsado: 0,
  // Cuota asignada (MB): administrador 200, Ana 100, Luis 50
  almacenamientoAsignado: [200, 100, 50][i] * 1024 * 1024,
  createdAt: haceDias(60)
}));
const [admin, ana, luis] = usuarios;

// ---------- Carpetas ----------
const plantilla = [
  ['Contratos', null], ['Informes', null], ['Administrativo', null],
  ['2025', 'Contratos'], ['2026', 'Contratos'], ['Mensuales', 'Informes'], ['Anuales', 'Informes']
];
const carpetas = [];
const carpetasDe = new Map(); // userId -> { nombre: doc }

function crearCarpeta(owner, nombre, padre) {
  const doc = {
    _id: new ObjectId(), nombre, ownerId: owner._id,
    parentId: padre ? padre._id : null,
    ancestors: padre ? [...padre.ancestors, padre._id] : [],
    createdAt: haceDias(55), updatedAt: new Date(),
    deletedAt: null, deletedBy: null, trashRootId: null
  };
  carpetas.push(doc);
  return doc;
}
for (const u of usuarios) {
  const mapa = {};
  for (const [nombre, padre] of plantilla) mapa[nombre] = crearCarpeta(u, nombre, padre ? mapa[padre] : null);
  carpetasDe.set(u._id.toString(), mapa);
}
const borradores = crearCarpeta(ana, 'Borradores', null); // se enviará a la papelera con 2 archivos

// ---------- Archivos (50) ----------
const BASES = ['Contrato', 'Informe', 'Acta', 'Memorando', 'Propuesta', 'Manual', 'Reporte', 'Notas'];
const LOREM = [
  'El presente documento describe los lineamientos generales de la organización.',
  'Se establecen responsabilidades, plazos y condiciones de cumplimiento.',
  'Los responsables deberán registrar cualquier modificación en el sistema.',
  'La información contenida es de uso interno y confidencial.',
  'Se recomienda revisar este documento de forma periódica.',
  'Los resultados obtenidos fueron presentados al comité directivo.'
];
const OPCIONES = [null, 'Contratos', 'Informes', 'Administrativo', '2025', '2026', 'Mensuales', 'Anuales'];

function generarContenido(base, ext, owner, i) {
  const parrafos = Array.from({ length: 2 + Math.floor(rnd() * 25) }, () => pick(LOREM));
  if (ext === 'md')
    return `# ${base} ${i + 1}\n\n**Autor:** ${owner.nombre}\n\n## Resumen\n\n${parrafos.join('\n\n')}\n\n- Punto 1\n- Punto 2\n`;
  return `${base.toUpperCase()} ${i + 1}\nAutor: ${owner.nombre}\n\n${parrafos.join('\n')}\n`;
}

const SUELTOS_EN_PAPELERA = [1, 5, 9, 15]; // archivos eliminados individualmente
const EN_BORRADORES = [25, 31]; // archivos de Ana que van dentro de la carpeta "Borradores"
const archivos = [];
const marcaPapelera = (id, ownerId, raiz) => ({
  deletedAt: haceDias(6), deletedBy: ownerId, trashRootId: raiz ?? id
});

for (let i = 0; i < 50; i++) {
  const owner = usuarios[i % 3];
  const base = pick(BASES);
  const ext = rnd() < 0.5 ? 'md' : 'txt';
  const nombre = `${base}_${String(i + 1).padStart(2, '0')}.${ext}`;
  const nombreCarpeta = pick(OPCIONES);
  let carpeta = nombreCarpeta ? carpetasDe.get(owner._id.toString())[nombreCarpeta] : null;
  if (EN_BORRADORES.includes(i)) carpeta = borradores;

  const contenido = Buffer.from(generarContenido(base, ext, owner, i), 'utf8');
  const createdAt = haceDias(40);
  const _id = new ObjectId();
  const gridFsId = await saveContent(contenido, nombre, { ownerId: owner._id });
  archivos.push({
    _id, nombre, extension: ext,
    mimeType: ext === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
    size: contenido.length, ownerId: owner._id, folderId: carpeta ? carpeta._id : null, gridFsId,
    createdAt, updatedAt: createdAt,
    deletedAt: null, deletedBy: null, trashRootId: null,
    ...(SUELTOS_EN_PAPELERA.includes(i) ? marcaPapelera(_id, owner._id) : {})
  });
}

// "Borradores" a la papelera en cascada (carpeta + sus 2 archivos)
Object.assign(borradores, marcaPapelera(borradores._id, ana._id));
for (const a of archivos.filter((a) => a.folderId?.equals(borradores._id)))
  Object.assign(a, { deletedAt: borradores.deletedAt, deletedBy: ana._id, trashRootId: borradores._id });

// Almacenamiento usado (la papelera cuenta hasta la eliminación definitiva)
for (const a of archivos) usuarios.find((u) => u._id.equals(a.ownerId)).almacenamientoUsado += a.size;

// ---------- Shares (32) ----------
const shares = [];
const PERMISOS = ['read', 'comment', 'edit'];
function compartir(recurso, tipo, indiceOwner, indiceDestino, permission) {
  shares.push({
    _id: new ObjectId(), resourceType: tipo, resourceId: recurso._id,
    ownerId: usuarios[indiceOwner]._id, sharedWithId: usuarios[indiceDestino]._id,
    permission, createdAt: despuesDe(recurso.createdAt)
  });
}
// 22 archivos (índices pares: ninguno está en la papelera)
for (let k = 0; k < 22; k++) {
  const idx = k * 2;
  compartir(archivos[idx], 'file', idx % 3, (idx % 3 + 1 + (k % 2)) % 3, PERMISOS[k % 3]);
}
// 6 archivos compartidos además con el tercer usuario (para el reporte "con más usuarios")
for (let k = 0; k < 6; k++) {
  const idx = k * 2;
  compartir(archivos[idx], 'file', idx % 3, (idx % 3 + 2 - (k % 2)) % 3, 'read');
}
// 4 carpetas
const f = (u, n) => carpetasDe.get(u._id.toString())[n];
compartir(f(ana, 'Contratos'), 'folder', 1, 2, 'edit');
compartir(f(luis, 'Informes'), 'folder', 2, 1, 'read');
compartir(f(admin, 'Administrativo'), 'folder', 0, 1, 'comment');
compartir(f(ana, 'Informes'), 'folder', 1, 0, 'read');

// ---------- Comentarios ----------
const comentarios = [];
const TEXTOS = ['Revisado, todo en orden.', 'Falta actualizar la fecha.', 'Por favor confirmar los montos.', 'Aprobado.'];
for (const s of shares.filter((s) => s.resourceType === 'file' && s.permission !== 'read').slice(0, 5)) {
  const u = usuarios.find((u) => u._id.equals(s.sharedWithId));
  comentarios.push({
    _id: new ObjectId(), fileId: s.resourceId, userId: u._id, userName: u.nombre,
    texto: pick(TEXTOS), createdAt: despuesDe(s.createdAt)
  });
}

// ---------- Historial de actividad ----------
const historial = [];
const registrar = (user, action, resourceType, recurso, timestamp, details = {}) =>
    historial.push({
      userId: user._id, userName: user.nombre, ownerId: recurso.ownerId ?? user._id,
      action, resourceType, resourceId: recurso._id, resourceName: recurso.nombre, details, timestamp
    });
const porId = (id) => usuarios.find((u) => u._id.equals(id));

for (const u of usuarios) for (let k = 0; k < 8; k++) registrar(u, 'login', 'user', u, haceDias(40));
for (const c of carpetas) registrar(porId(c.ownerId), 'create_folder', 'folder', c, c.createdAt, { parentId: c.parentId });
for (const a of archivos) {
  const dueno = porId(a.ownerId);
  registrar(dueno, 'upload', 'file', a, a.createdAt, { size: a.size });
  const extras = Math.floor(rnd() * 4);
  for (let k = 0; k < extras; k++)
    registrar(dueno, pick(['download', 'view', 'rename', 'edit', 'move']), 'file', a, despuesDe(a.createdAt));
}
for (const s of shares) {
  const recurso = (s.resourceType === 'file' ? archivos : carpetas).find((r) => r._id.equals(s.resourceId));
  const destinatario = porId(s.sharedWithId);
  registrar(porId(s.ownerId), 'share', s.resourceType, recurso, s.createdAt,
      { sharedWith: destinatario.nombre, sharedWithId: destinatario._id, permission: s.permission });
  if (s.resourceType === 'file' && rnd() < 0.6) registrar(destinatario, 'download', 'file', recurso, despuesDe(s.createdAt));
}
for (const c of comentarios) {
  const a = archivos.find((a) => a._id.equals(c.fileId));
  registrar(porId(c.userId), 'comment', 'file', a, c.createdAt);
}
for (const a of archivos.filter((a) => a.deletedAt && a.trashRootId.equals(a._id)))
  registrar(porId(a.ownerId), 'trash', 'file', a, a.deletedAt);
registrar(ana, 'trash', 'folder', borradores, borradores.deletedAt, { carpetas: 1, archivos: 2 });
historial.sort((a, b) => a.timestamp - b.timestamp);

// ---------- Inserción ----------
await col('users').insertMany(usuarios);
await col('folders').insertMany(carpetas);
await col('files').insertMany(archivos);
await col('shares').insertMany(shares);
await col('comments').insertMany(comentarios);
await col('activity_log').insertMany(historial);

const enPapelera = archivos.filter((a) => a.deletedAt).length + 1;
console.log('Carga inicial completada');
console.log(`  usuarios: ${usuarios.length} | carpetas: ${carpetas.length} | archivos: ${archivos.length}`);
console.log(`  shares: ${shares.length} | comentarios: ${comentarios.length} | actividad: ${historial.length}`);
console.log(`  recursos en papelera: ${enPapelera} (incluye 1 carpeta)`);
console.log('  Credenciales (todos): admin@docs.com / ana@docs.com / luis@docs.com  — contraseña: ' + PASSWORD);
await closeDB();
