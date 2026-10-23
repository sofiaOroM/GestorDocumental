// Se ejecuta al iniciar el contenedor: carga los datos de demostración solo si la base está vacía.
// (npm run seed, en cambio, SIEMPRE borra y recarga.)
import { config } from '../src/config.js';
import { connectDB, closeDB, col } from '../src/db.js';

let intentos = 0;
for (;;) {
  try {
    await connectDB(config.mongoUri, config.dbName);
    break;
  } catch (e) {
    if (++intentos >= 15) throw e;
    console.log(`Esperando a MongoDB (${intentos})...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const usuarios = await col('users').countDocuments();
await closeDB();

if (usuarios === 0) {
  console.log('Base de datos vacía: ejecutando carga inicial...');
  await import('./seed.js');
} else {
  console.log(`La base ya tiene datos (${usuarios} usuarios): se omite la carga inicial.`);
}
