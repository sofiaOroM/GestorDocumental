import { MongoClient, GridFSBucket } from 'mongodb';

let client, db, bucket;

export async function connectDB(uri, dbName) {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  // GridFS: el contenido de los archivos vive en contenido.files / contenido.chunks
  bucket = new GridFSBucket(db, { bucketName: 'contenido' });
  return db;
}

export const closeDB = () => client?.close();
export const getBucket = () => bucket;
export const col = (nombre) => db.collection(nombre);

export async function createIndexes() {
  await Promise.all([
    // Login y unicidad de correo
    col('users').createIndex({ email: 1 }, { unique: true }),

    // Listado de contenido de una carpeta (excluye papelera con deletedAt)
    col('folders').createIndex({ ownerId: 1, parentId: 1, deletedAt: 1 }),
    // Descendientes y detección de ciclos
    col('folders').createIndex({ ancestors: 1 }),
    col('folders').createIndex({ trashRootId: 1 }),

    col('files').createIndex({ ownerId: 1, folderId: 1, deletedAt: 1 }),
    col('files').createIndex({ ownerId: 1, extension: 1 }),
    col('files').createIndex({ createdAt: 1 }),
    col('files').createIndex({ folderId: 1 }),
    col('files').createIndex({ trashRootId: 1 }),

    // Un recurso solo se comparte una vez con el mismo usuario
    col('shares').createIndex(
      { resourceType: 1, resourceId: 1, sharedWithId: 1 },
      { unique: true }
    ),
    col('shares').createIndex({ sharedWithId: 1 }),
    col('shares').createIndex({ ownerId: 1 }),

    col('activity_log').createIndex({ userId: 1, timestamp: -1 }),
    col('activity_log').createIndex({ ownerId: 1, timestamp: -1 }),
    col('activity_log').createIndex({ resourceId: 1, timestamp: -1 }),
    col('activity_log').createIndex({ action: 1 }),

    col('comments').createIndex({ fileId: 1, createdAt: 1 })
  ]);
}
