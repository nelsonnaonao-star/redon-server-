import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { zone } = req.query;
  let businesses;
  if (zone) {
    businesses = db.prepare('SELECT * FROM businesses WHERE zone = ? ORDER BY created_at DESC').all(zone);
  } else {
    businesses = db.prepare('SELECT * FROM businesses ORDER BY created_at DESC').all();
  }
  res.json(businesses.map(b => ({
    id: b.id,
    businessName: b.business_name,
    description: b.description,
    imageUrl: b.image_url || '',
    zone: b.zone,
    category: b.category,
    contactName: b.contact_name,
    contactPhone: b.contact_phone
  })));
});

router.post('/', (req, res) => {
  const { businessName, description, imageUrl, zone, category, contactName, contactPhone } = req.body;
  if (!businessName || !description || !zone || !contactName) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO businesses (id, user_id, business_name, description, image_url, zone, category, contact_name, contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, businessName, description, imageUrl || '', zone, category || 'General', contactName, contactPhone || '');
  res.status(201).json({ id, businessName, description, imageUrl, zone, category, contactName, contactPhone });
});

export default router;
