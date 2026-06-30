import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import fcmRoutes from './routes/fcm.js';
import turnRoutes from './routes/turn.js';
import linkPreviewRoutes from './routes/linkpreview.js';
import mediaRoutes from './routes/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await initDb();
  console.log('Base de datos inicializada');

  const app = express();

  app.set('trust proxy', 1); // Render trusted proxy for rate-limiter

  const staticOrigins = [
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:3000',
    'capacitor://localhost',
    'file://',
    'https://redon-server.onrender.com',
    'https://redon-app.onrender.com',
    process.env.CORS_ORIGIN || '',
  ].filter(Boolean);

  const clientOrigin = process.env.CLIENT_ORIGIN || '';
  if (clientOrigin && !staticOrigins.includes(clientOrigin)) {
    staticOrigins.push(clientOrigin);
  }

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (staticOrigins.includes(origin)) return callback(null, true);
      if (clientOrigin && origin.endsWith(new URL(clientOrigin).hostname)) return callback(null, true);
      callback(null, true);
    },
    credentials: true,
  }));
  console.log('CORS configurado dinámicamente');

  // ─── HTTP Security Headers (Helmet) ──────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
  console.log('Helmet configurado');

  // ─── Global Rate Limiter ─────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,       // 5 minutes
    max: 100,                        // max 100 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
  });
  app.use('/api/', globalLimiter);
  console.log('Rate limiter global configurado (100 req / 5 min)');

  // ─── Strict SMS Rate Limiter ─────────────────────────────────────
  const smsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,       // 15 minutes
    max: 3,                          // max 3 SMS code requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Has solicitado demasiados códigos. Espera 15 minutos.' },
  });
  app.use('/api/auth/send-reset-code', smsLimiter);
  console.log('SMS rate limiter configurado (3 req / 15 min)');

  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/fcm', fcmRoutes);
  app.use('/api/turn', turnRoutes);
  app.use('/api/link-preview', linkPreviewRoutes);
  app.use('/api/media', mediaRoutes);

  const PORT = process.env.PORT || process.env.SERVER_PORT || 5000;
  app.listen(PORT, () => {
    console.log(`RED ON Server corriendo en puerto ${PORT}`);
  });
}

main().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
