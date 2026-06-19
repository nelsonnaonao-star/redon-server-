import { Router } from 'express';
import { getOne, getAll, run } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const contacts = getAll(`
    SELECT c.contact_user_id as id, c.name, u.username, u.phone, u.avatar, u.online, u.bio
    FROM contacts c JOIN users u ON c.contact_user_id = u.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `, [req.userId]);

  const enriched = contacts.map(c => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar || '',
    avatarColor: c.avatar ? '' : 'bg-slate-450',
    lastMessage: 'Sin mensajes aún',
    time: '',
    unreadCount: 0,
    isOnline: c.online === 1,
    phone: c.phone || '',
    username: c.username ? `@${c.username}` : '',
    bio: c.bio || '',
    messages: []
  }));

  res.json(enriched);
});

router.post('/add', (req, res) => {
  const { phone, name } = req.body;
  if (!phone || !name) return res.status(400).json({ error: 'phone y name requeridos' });

  const cleanPhone = phone.replace(/[\s+]/g, '');
  const users = getAll('SELECT * FROM users');
  const contactUser = users.find(u => u.phone.replace(/[\s+]/g, '').includes(cleanPhone));

  if (!contactUser) {
    return res.status(404).json({ error: 'No se encontró ningún usuario RED ON con ese número' });
  }

  if (contactUser.id === req.userId) {
    return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
  }

  const existing = getOne('SELECT 1 as ok FROM contacts WHERE user_id = ? AND contact_user_id = ?', [req.userId, contactUser.id]);
  if (existing) {
    return res.status(409).json({ error: 'Este contacto ya existe en tu lista' });
  }

  run('INSERT INTO contacts (user_id, contact_user_id, name) VALUES (?, ?, ?)', [req.userId, contactUser.id, name]);

  res.status(201).json({
    contact: {
      id: contactUser.id,
      name,
      username: `@${contactUser.username}`,
      phone: contactUser.phone,
      avatar: contactUser.avatar || '',
      online: contactUser.online === 1,
      bio: contactUser.bio || ''
    }
  });
});

router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase().replace(/^@/, '');
  if (!q || q.length < 2) return res.json([]);

  const users = getAll(`
    SELECT id, name, username, phone, avatar, bio FROM users
    WHERE (LOWER(username) LIKE ? OR LOWER(name) LIKE ?)
    AND id != ?
    LIMIT 10
  `, [`%${q}%`, `%${q}%`, req.userId]);

  const phoneUsers = users.length < 10
    ? getAll('SELECT id, name, username, phone, avatar, bio FROM users WHERE id != ?', [req.userId])
        .filter(u => u.phone.replace(/[\s+]/g, '').includes(q))
        .slice(0, 10 - users.length)
    : [];

  const merged = [...users, ...phoneUsers.filter(u => !users.find(x => x.id === u.id))];
  res.json(merged.map(u => ({ ...u, username: `@${u.username}` })));
});

export default router;
