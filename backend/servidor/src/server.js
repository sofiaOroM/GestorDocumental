import { config } from './config.js';
import { connectDB, createIndexes } from './db.js';
import { app } from './app.js';

await connectDB(config.mongoUri, config.dbName);
await createIndexes();
app.listen(config.port, () =>
  console.log(`Servidor listo en http://localhost:${config.port}/api`)
);
