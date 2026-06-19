import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getOne, getAll, run } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.post('/send', (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: 'chatId y text requeridos' });

  const isParticipant = getOne('SELECT 1 as ok FROM chat_participants WHERE chat_id = ? AND user_id = ?', [chatId, req.userId]);
  if (!isParticipant) return res.status(403).json({ error: 'No eres participante' });

  const msgId = uuidv4();
  const createdAt = new Date().toISOString();

  run("INSERT INTO messages (id, chat_id, sender_id, text, status, created_at) VALUES (?, ?, ?, ?, 'sent', ?)", [msgId, chatId, req.userId, text, createdAt]);

  const message = { id: msgId, sender: 'me', text, time: createdAt, status: 'sent' };

  const otherUsers = getAll('SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?', [chatId, req.userId]);

  res.status(201).json({ message, otherUsers: otherUsers.map(u => u.user_id) });
});

router.post('/direct', (req, res) => {
  const { contactUserId, text } = req.body;
  if (!contactUserId || !text) return res.status(400).json({ error: 'contactUserId y text requeridos' });

  const chats = getAll(`
    SELECT cp1.chat_id as id FROM chat_participants cp1
    JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
    WHERE cp1.user_id = ? AND cp2.user_id = ?
  `, [req.userId, contactUserId]);

  let chat = chats.find(c => {
    const cRec = getOne('SELECT is_business FROM chats WHERE id = ?', [c.id]);
    return cRec && !cRec.is_business;
  });

  if (!chat) {
    const chatId = uuidv4();
    run('INSERT INTO chats (id) VALUES (?)', [chatId]);
    run('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)', [chatId, req.userId, chatId, contactUserId]);
    chat = { id: chatId };
  }

  const msgId = uuidv4();
  const createdAt = new Date().toISOString();
  run("INSERT INTO messages (id, chat_id, sender_id, text, status, created_at) VALUES (?, ?, ?, ?, 'sent', ?)", [msgId, chat.id, req.userId, text, createdAt]);

  const message = { id: msgId, sender: 'me', text, time: createdAt, status: 'sent', chatId: chat.id };

  res.status(201).json({ message, chatId: chat.id, otherUsers: [contactUserId] });
});

export default router;
