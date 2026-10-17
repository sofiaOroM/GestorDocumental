import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/errors.js';
import { HttpError } from './utils/http.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import folders from './routes/folders.js';
import files from './routes/files.js';
import shares from './routes/shares.js';
import trash from './routes/trash.js';
import activity from './routes/activity.js';
import reports from './routes/reports.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

app.use('/api/auth', auth);
app.use('/api/users', users);
app.use('/api/folders', folders);
app.use('/api/files', files);
app.use('/api/shares', shares);
app.use('/api/trash', trash);
app.use('/api/activity', activity);
app.use('/api/reports', reports);

app.use((req, res, next) => next(new HttpError(404, 'Ruta no encontrada')));
app.use(errorHandler);
