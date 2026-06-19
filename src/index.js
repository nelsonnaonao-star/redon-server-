import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb, getOne, getAll, run } from './db.js';
import authRoutes from './routes/auth.js';
import chatsRoutes from './routes/chats.js';
import messagesRoutes from './routes/messages.js';
import contactsRoutes from './routes/contacts.js';
import profileRoutes from './routes/profile.js';
import businessesRoutes from './routes/businesses.js';
import { setupSocket, sendToUser } from './socket/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await initDb();
  console.log('Base de datos inicializada');

  // Seed demo user
  const demoUser = getOne('SELECT id FROM users WHERE username = ?', ['demo']);
  if (!demoUser) {
    const bcrypt = (await import('bcryptjs')).default;
    const { v4: uuidv4 } = await import('uuid');
    const hash = bcrypt.hashSync('1234', 10);
    run('INSERT INTO users (id, name, username, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'Usuario Demo', 'demo', '+58 412 000 0000', hash]);
    console.log('Usuario demo creado (demo / 1234)');
  }

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/chats', chatsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/businesses', businessesRoutes);

  // WebSocket hook para mensajes via HTTP response
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (req.path === '/api/messages/send' && req.method === 'POST' && res.statusCode === 201) {
        const { otherUsers, message, chatId } = body;
        if (otherUsers) {
          otherUsers.forEach(uid => {
            sendToUser(uid, 'chat:message', { ...message, sender: 'them', chatId: chatId || req.body.chatId });
          });
        }
      }
      if (req.path === '/api/messages/direct' && req.method === 'POST' && res.statusCode === 201) {
        const { otherUsers, message, chatId } = body;
        if (otherUsers) {
          otherUsers.forEach(uid => {
            sendToUser(uid, 'chat:new', { message: { ...message, sender: 'them' }, chatId });
          });
        }
      }
      return originalJson(body);
    };
    next();
  });

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`RED ON Server corriendo en puerto ${PORT}`);
  });

  setupSocket(io);
}

main().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
