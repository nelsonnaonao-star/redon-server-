import db from '../db.js';

const userSockets = new Map();
let ioInstance = null;

export function setupSocket(io) {
  ioInstance = io;

  io.use((socket, next) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) return next(new Error('userId requerido'));
    socket.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    userSockets.set(socket.userId, socket.id);
    db.prepare('UPDATE users SET online = 1 WHERE id = ?').run(socket.userId);
    io.emit('user:online', { userId: socket.userId, online: true });

    socket.on('disconnect', () => {
      userSockets.delete(socket.userId);
      db.prepare('UPDATE users SET online = 0 WHERE id = ?').run(socket.userId);
      io.emit('user:online', { userId: socket.userId, online: false });
    });
  });
}

export function sendToUser(userId, event, data) {
  const socketId = userSockets.get(userId);
  if (socketId && ioInstance) {
    ioInstance.to(socketId).emit(event, data);
  }
}
