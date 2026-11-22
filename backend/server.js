import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes.js';
import conductorRoutes from './routes/conductorRoutes.js';
import transitRoutes from './routes/transitRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import studentPassRoutes from './routes/studentPassRoutes.js';
import { pool } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '0.0.0.0';
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set([
  frontendOrigin,
  ...(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);
const jwtSecret = process.env.JWT_SECRET || '';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendDist = join(projectRoot, 'frontend', 'dist');
const frontendIndex = join(frontendDist, 'index.html');

if (Buffer.byteLength(jwtSecret, 'utf8') < 32 || jwtSecret.includes('replace-this')) {
  throw new Error('Set JWT_SECRET in backend/.env to a random value at least 32 characters long.');
}

const app = express();
let databaseConnected = false;

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, false);
    return callback(null, allowedOrigins.has(origin) ? origin : false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'database_unavailable',
    database: databaseConnected ? 'connected' : 'not connected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/conductor', conductorRoutes);
app.use('/api/transit', transitRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/student-passes', studentPassRoutes);

if (existsSync(frontendIndex)) {
  app.use(express.static(frontendDist, { index: false }));
  app.get('/{*path}', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return res.sendFile(frontendIndex, (error) => {
      if (error) next(error);
    });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(port, host, () => {
  console.log(`BMTC app listening on ${host}:${port}`);
});

pool.query('SELECT 1')
  .then(() => {
    databaseConnected = true;
    console.log('MySQL connection ready.');
  })
  .catch(() => {
    databaseConnected = false;
    console.warn('MySQL is unavailable. Start/configure the local server before using database features.');
  });

async function stopServer() {
  server.close();
  await pool.end();
}

process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
