import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'gestion_documental',
  jwtSecret: process.env.JWT_SECRET ,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  //maxFileBytes: (Number(process.env.MAX_FILE_MB) || 5) * 1024 * 1024
  maxFileBytes: Number(process.env.MAX_FILE_MB) > 0 ? Number(process.env.MAX_FILE_MB) * 1024 * 1024 : undefined
};
