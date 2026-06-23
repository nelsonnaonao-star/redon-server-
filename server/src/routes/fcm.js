import express from 'express';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://akgsylutbpgolurkcavh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const vapidPublicKey = process.env.VITE_FIREBASE_VAPID_KEY || '';
const vapidPrivateKey = process.env.FIREBASE_PRIVATE_VAPID_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'admin@redon.app';

let firebaseAdmin = null;

async function initFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  try {
    const mod = await import('firebase-admin');
    const admin = mod.default || mod;
    if (!admin.apps?.length) {
      let credentials = null;

      const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FCM_SERVICE_ACCOUNT;
      if (saEnv) {
        try { credentials = JSON.parse(saEnv); } catch {
          console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON');
        }
      }

      if (!credentials) {
        const searchPaths = [
          path.join(__dirname, '..', '..', '..', 'red-on-7e788-firebase-adminsdk-fbsvc-801e8d6528.json'),
          path.join(__dirname, '..', '..', '..', 'firebase-credentials.json'),
          process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
        ].filter(Boolean);
        for (const fp of searchPaths) {
          try {
            const content = fs.readFileSync(fp, 'utf-8');
            credentials = JSON.parse(content);
            if (credentials) {
              console.log('[FCM] Firebase Admin loaded from local file:', path.basename(fp));
              break;
            }
          } catch {}
        }
      }

      if (credentials) {
        admin.initializeApp({ credential: admin.credential.cert(credentials) });
        console.log('[FCM] Firebase Admin initialized successfully');
      } else {
        console.warn('[FCM] No Firebase Admin credentials found — Android FCM push unavailable');
      }
    }
    if (admin.apps?.length) {
      firebaseAdmin = admin;
    }
  } catch (err) {
    console.warn('[FCM] Firebase Admin init error:', err.message);
  }
  return firebaseAdmin;
}

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);
}

async function getTokens(profileId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token, device')
      .eq('profile_id', profileId);
    if (!error && data) return data;
  }
  return [];
}

// ─── REGISTER: called by the Capacitor app to store a new push token ────
// Stores directly in Supabase (Postgres) so tokens survive Render deploys.
router.post('/register', async (req, res) => {
  const { profile_id, token, device } = req.body;
  if (!profile_id || !token) {
    return res.status(400).json({ error: 'profile_id and token required' });
  }
  const tokenStr = typeof token === 'object' ? JSON.stringify(token) : token;

  if (supabase) {
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { profile_id, token: tokenStr, device: device || 'android-fcm' },
        { onConflict: 'profile_id,token' }
      );
    if (error) {
      console.warn('[FCM] Register error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  res.json({ ok: true });
});

// ─── SEND: called by the frontend (best-effort, for calls only now) ────
// Messages are sent via Supabase Database Webhook (see /webhook).
router.post('/send', async (req, res) => {
  const { profile_id, title, body, data } = req.body;
  if (!profile_id || !title) {
    return res.status(400).json({ error: 'profile_id and title required' });
  }

  const tokens = await getTokens(profile_id);
  if (!tokens.length) {
    return res.json({ ok: true, sent: 0 });
  }

  const results = { web: 0, android: 0, errors: 0 };

  for (const t of tokens) {
    if (t.device === 'android-fcm' || t.device === 'android') {
      const admin = await initFirebaseAdmin();
      if (admin) {
        try {
          const isCall = data && data.type === 'call';
          const message = {
            token: t.token,
            data: {
              title,
              body,
              badge: '1',
              notificationCount: '1',
              ...(data || {}),
            },
            ...(!isCall ? {
              notification: {
                title: title || 'RED ON',
                body: body || 'Nuevo mensaje',
              },
            } : {}),
            android: {
              priority: 'high',
              ttl: '86400s',
              notification: {
                channel_id: isCall ? 'redon-calls' : 'redon-messages',
                tag: data?.chatId || 'redon-message',
                click_action: 'OPEN_APP',
                notification_count: 1,
                visibility: 'public',
              },
            },
          };
          await admin.messaging().send(message);
          results.android++;
        } catch {
          results.errors++;
        }
      } else {
        results.errors++;
      }
    } else {
      try {
        const subscription = JSON.parse(t.token);
        const payload = JSON.stringify({ title, body, data: data || {}, icon: '/icon.png', badge: '/badge.png' });
        await webpush.sendNotification(subscription, payload);
        results.web++;
      } catch {
        results.errors++;
      }
    }
  }

  res.json({ ok: true, ...results });
});

// ─── WEBHOOK: called by Supabase Database Webhook when a message is inserted ────
// This is the RELIABLE path — runs server-side, doesn't depend on sender's frontend.
// Supabase sends: { type: 'INSERT', table: 'messages', record: { ... }, ... }
router.post('/webhook', async (req, res) => {
  // Reject non-Supabase requests (basic check — Supabase sends a specific body shape)
  const { type, table, record } = req.body;
  if (type !== 'INSERT' || table !== 'messages' || !record) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const { chat_id, sender_id, text } = record;
  if (!chat_id || !sender_id) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  // Find the recipient (the other participant in this chat)
  let receiverId = null;
  try {
    const { data: participants } = supabase
      ? await supabase
          .from('chat_participants')
          .select('profile_id')
          .eq('chat_id', chat_id)
          .neq('profile_id', sender_id)
          .limit(1)
      : { data: null };
    if (participants && participants.length > 0) {
      receiverId = participants[0].profile_id;
    }
  } catch {}

  if (!receiverId) {
    return res.status(200).json({ ok: true, skipped: 'no receiver' });
  }

  // Get sender's name
  let senderName = 'RED ON';
  try {
    const { data: profile } = supabase
      ? await supabase
          .from('profiles')
          .select('name')
          .eq('id', sender_id)
          .single()
      : { data: null };
    if (profile && profile.name) {
      senderName = profile.name;
    }
  } catch {}

  // Get receiver's push tokens
  const tokens = await getTokens(receiverId);
  if (!tokens.length) {
    return res.status(200).json({ ok: true, sent: 0, reason: 'no tokens' });
  }

  const results = { web: 0, android: 0, errors: 0 };

  for (const t of tokens) {
    if (t.device === 'android-fcm' || t.device === 'android') {
      const admin = await initFirebaseAdmin();
      if (admin) {
        try {
          const message = {
            token: t.token,
            data: {
              title: senderName,
              body: text || 'Nuevo mensaje',
              badge: '1',
              notificationCount: '1',
              chatId: chat_id,
              type: 'message',
              contactId: sender_id,
            },
            notification: {
              title: senderName || 'RED ON',
              body: text || 'Nuevo mensaje',
            },
            android: {
              priority: 'high',
              ttl: '86400s',
              notification: {
                channel_id: 'redon-messages',
                tag: chat_id,
                click_action: 'OPEN_APP',
                notification_count: 1,
                visibility: 'public',
              },
            },
          };
          await admin.messaging().send(message);
          results.android++;
        } catch (err) {
          console.warn('[FCM] Webhook send error:', err.message);
          results.errors++;
        }
      } else {
        results.errors++;
      }
    } else {
      try {
        const subscription = JSON.parse(t.token);
        const payload = JSON.stringify({
          title: senderName,
          body: text || 'Nuevo mensaje',
          data: { chatId: chat_id, type: 'message', contactId: sender_id },
          icon: '/icon.png',
          badge: '/badge.png',
        });
        await webpush.sendNotification(subscription, payload);
        results.web++;
      } catch {
        results.errors++;
      }
    }
  }

  res.json({ ok: true, ...results });
});

export default router;
