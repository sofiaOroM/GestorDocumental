import 'dotenv/config';

// El secreto de los tokens es obligatorio en producción; en desarrollo se avisa y se usa uno de prueba.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production')
  throw new Error('Falta la variable de entorno JWT_SECRET (obligatoria en producción)');
if (!jwtSecret)
  console.warn('[aviso] JWT_SECRET no está definido: se usa un secreto de desarrollo. Defínelo en el archivo .env');

const positivo = (v, porDefecto) => (Number(v) > 0 ? Number(v) : porDefecto);

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'gestion_documental',
  jwtSecret: jwtSecret || 'secreto-de-desarrollo-no-usar-en-produccion',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  // Opcional: sin MAX_FILE_MB no hay límite de tamaño por archivo
  maxFileBytes: Number(process.env.MAX_FILE_MB) > 0 ? Number(process.env.MAX_FILE_MB) * 1024 * 1024 : undefined,
  // Espacio total que se asigna por defecto a cada usuario nuevo (MB -> bytes)
  defaultQuotaBytes: positivo(process.env.DEFAULT_QUOTA_MB, 100) * 1024 * 1024
};
