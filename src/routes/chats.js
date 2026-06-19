import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOne, getAll, run } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const participations = getAll('SELECT chat_id FROM chat_participants WHERE user_id = ?', [req.userId]);
  if (participations.length === 0) return res.json([]);

  const chatIds = participations.map(r => r.chat_id);
  const chats = getAll('SELECT * FROM chats WHERE id IN (' + chatIds.map(() => '?').join(',') + ') ORDER BY created_at DESC', chatIds);

  const result = chats.map(chat => {
    const participants = getAll(`
      SELECT u.id, u.name, u.username, u.phone, u.avatar, u.online
      FROM users u JOIN chat_participants cp ON u.id = cp.user_id
      WHERE cp.chat_id = ? AND u.id != ?
    `, [chat.id, req.userId]);

    const lastMsg = getOne('SELECT text, created_at, sender_id FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1', [chat.id]);
    const unreadCount = getOne('SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ? AND sender_id != ? AND status = ?', [chat.id, req.userId, 'sent']);
    const unread = unreadCount ? unreadCount.cnt : 0;

    return {
      id: chat.id,
      name: chat.is_business ? chat.business_name : (participants[0]?.name || 'Usuario'),
      avatar: chat.is_business ? chat.business_image : (participants[0]?.avatar || ''),
      avatarColor: participants[0] ? '' : 'bg-slate-450',
      lastMessage: lastMsg ? lastMsg.text : 'Sin mensajes aún',
      time: lastMsg ? lastMsg.created_at : chat.created_at,
      unreadCount: unread,
      isOnline: chat.is_business ? false : (participants[0]?.online === 1),
      phone: chat.is_business ? '' : (participants[0]?.phone || ''),
      username: participants[0]?.username || '',
      bio: chat.is_business ? chat.business_desc : (participants[0]?.bio || ''),
      messages: []
    };
  });

  res.json(result);
});

router.get('/:id/messages', (req, res) => {
  const { id } = req.params;
  const isParticipant = getOne('SELECT 1 as ok FROM chat_participants WHERE chat_id = ? AND user_id = ?', [id, req.userId]);
  if (!isParticipant) return res.status(403).json({ error: 'No eres participante de este chat' });

  const messages = getAll('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC', [id]);
  const enriched = messages.map(m => ({
    id: m.id,
    sender: m.sender_id === req.userId ? 'me' : 'them',
    text: m.text,
    time: m.created_at,
    status: m.status
  }));

  res.json(enriched);
});

router.post('/:id/read', (req, res) => {
  const { id } = req.params;
  run("UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender_id != ?", [id, req.userId]);
  res.json({ ok: true });
});

export default router;
