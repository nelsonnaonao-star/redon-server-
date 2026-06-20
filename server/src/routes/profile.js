import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const user = db.prepare('SELECT id, name, username, phone, avatar, bio FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ...user, username: `@${user.username}` });
});

router.put('/', (req, res) => {
  const { name, bio, avatar } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
  if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
  if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
  params.push(req.userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT id, name, username, phone, avatar, bio FROM users WHERE id = ?').get(req.userId);
  res.json({ ...user, username: `@${user.username}` });
});

export default router;
