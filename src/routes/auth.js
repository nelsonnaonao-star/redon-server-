import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getOne, getAll, run } from '../db.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { name, phone, username, password } = req.body;
  if (!name || !phone || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }

  const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
  const cleanPhone = phone.trim();

  const existing = getOne('SELECT id FROM users WHERE username = ? OR phone = ?', [cleanUsername, cleanPhone]);
  if (existing) {
    return res.status(409).json({ error: 'El usuario o teléfono ya está registrado' });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);

  run('INSERT INTO users (id, name, username, phone, password_hash) VALUES (?, ?, ?, ?, ?)', [id, name, cleanUsername, cleanPhone, hash]);

  const token = generateToken(id);
  res.status(201).json({
    token,
    user: { id, name, username: `@${cleanUsername}`, phone: cleanPhone, avatar: '', bio: 'Disponible en RED ON' }
  });
});

router.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Usuario/telefono y contraseña requeridos' });
  }

  const input = identifier.toLowerCase().trim().replace(/^@/, '');
  let user = getOne('SELECT * FROM users WHERE username = ?', [input]);
  if (!user) {
    const cleanPhone = input.replace(/[\s+]/g, '');
    const users = getAll('SELECT * FROM users');
    user = users.find(u => u.phone.replace(/[\s+]/g, '').includes(cleanPhone));
  }
  if (!user) {
    return res.status(404).json({ error: 'Usuario o teléfono no encontrado' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  const token = generateToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: `@${user.username}`,
      phone: user.phone,
      avatar: user.avatar || '',
      bio: user.bio || ''
    }
  });
});

router.post('/forgot', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Usuario requerido' });
  const input = identifier.toLowerCase().trim().replace(/^@/, '');
  const user = getOne('SELECT id, username, phone FROM users WHERE username = ?', [input]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ message: 'Instrucciones enviadas (simulado)', username: user.username });
});

export default router;
