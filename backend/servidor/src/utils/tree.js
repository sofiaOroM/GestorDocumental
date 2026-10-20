import { col } from '../db.js';

// por si Existe un hermano (no eliminado) con el mismo nombre
export function nameTaken(coleccion, ownerId, campoPadre, padreId, nombre, excluirId = null) {
  const filtro = { ownerId, [campoPadre]: padreId, nombre, deletedAt: null };
  if (excluirId) filtro._id = { $ne: excluirId };
  return col(coleccion).findOne(filtro, { projection: { _id: 1 } });
}

// Genera un nombre libre al restaurar: "informe (restaurado).md", "informe (restaurado 2).md"...
export async function uniqueName(coleccion, ownerId, campoPadre, padreId, nombre, conExt) {
  const i = conExt ? nombre.lastIndexOf('.') : -1;
  const base = i > 0 ? nombre.slice(0, i) : nombre;
  const ext = i > 0 ? nombre.slice(i) : '';
  let candidato = nombre;
  let n = 0;
  while (await nameTaken(coleccion, ownerId, campoPadre, padreId, candidato)) {
    n++;
    candidato = `${base} (restaurado${n > 1 ? ' ' + n : ''})${ext}`;
  }
  return candidato;
}

// Mueve una carpeta a otro padre (o a la raíz) y recalcula "ancestors" de TODOS sus descendientes.
// descendiente.ancestors = [...ancestrosViejos, carpeta, ...resto]  =>  [...ancestrosNuevos, carpeta, ...resto]
export async function reparentFolder(folder, nuevoPadre) {
  const folders = col('folders');
  const viejos = folder.ancestors;
  const nuevos = nuevoPadre ? [...nuevoPadre.ancestors, nuevoPadre._id] : [];

  await folders.updateOne(
    { _id: folder._id },
    { $set: { parentId: nuevoPadre ? nuevoPadre._id : null, ancestors: nuevos, updatedAt: new Date() } }
  );

  const descendientes = await folders
    .find({ ancestors: folder._id }, { projection: { ancestors: 1 } })
    .toArray();
  if (descendientes.length) {
    await folders.bulkWrite(
      descendientes.map((d) => ({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { ancestors: [...nuevos, folder._id, ...d.ancestors.slice(viejos.length + 1)] } }
        }
      }))
    );
  }
}
