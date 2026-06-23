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
        // Get cert function: v14+ subpath export first, fallback to namespace
        let certFn;
        try {
          const { cert } = await import('firebase-admin/credential');
          certFn = cert;
        } catch {
          certFn = admin.credential?.cert;
        }
        if (!certFn) {
          throw new Error('credential.cert not found in firebase-admin');
        }
        admin.initializeApp({ credential: certFn(credentials) });
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
  console.log('[FCM-SEND] requested for profile:', profile_id, 'title:', title);
  if (!profile_id || !title) {
    return res.status(400).json({ error: 'profile_id and title required' });
  }

  const tokens = await getTokens(profile_id);
  console.log('[FCM-SEND] tokens found:', tokens.length);
  if (!tokens.length) {
    return res.json({ ok: true, sent: 0 });
  }

  const results = { web: 0, android: 0, errors: 0 };

  for (const t of tokens) {
    console.log('[FCM-SEND] device:', t.device);
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
          const resp = await admin.messaging().send(message);
          console.log('[FCM-SEND] FCM success:', resp);
          results.android++;
        } catch (err) {
          console.error('[FCM-SEND] FCM error:', err.message, err.code || '');
          results.errors++;
        }
      } else {
        console.error('[FCM-SEND] Firebase Admin not initialized');
        results.errors++;
      }
    } else {
      try {
        const subscription = JSON.parse(t.token);
        const payload = JSON.stringify({ title, body, data: data || {}, icon: '/icon.png', badge: '/badge.png' });
        await webpush.sendNotification(subscription, payload);
        console.log('[FCM-SEND] web push success');
        results.web++;
      } catch (err) {
        console.error('[FCM-SEND] web push error:', err.message);
        results.errors++;
      }
    }
  }

  console.log('[FCM-SEND] results:', JSON.stringify(results));
  res.json({ ok: true, ...results });
});

// ─── WEBHOOK: called by Supabase Database Webhook when a message is inserted ────
// This is the RELIABLE path — runs server-side, doesn't depend on sender's frontend.
// Supabase sends: { type: 'INSERT', table: 'messages', record: { ... }, ... }
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  console.log('[FCM-WEBHOOK] Received webhook from Supabase');

  const { type, table, record } = req.body;
  console.log('[FCM-WEBHOOK] body keys:', Object.keys(req.body).join(', '));
  console.log('[FCM-WEBHOOK] type:', type, 'table:', table, 'has record:', !!record);

  if (type !== 'INSERT' || table !== 'messages' || !record) {
    console.warn('[FCM-WEBHOOK] Invalid payload shape — ignoring');
    return res.status(200).json({ ok: true, ignored: 'invalid shape' });
  }

  const { chat_id, sender_id, text } = record;
  console.log('[FCM-WEBHOOK] record -> chat_id:', chat_id, 'sender_id:', sender_id, 'text_length:', text?.length);

  if (!chat_id || !sender_id) {
    console.warn('[FCM-WEBHOOK] missing chat_id or sender_id — skipping');
    return res.status(200).json({ ok: true, skipped: 'missing ids' });
  }

  // Find the recipient (the other participant in this chat)
  let receiverId = null;
  if (supabase) {
    try {
      const { data: participants, error } = await supabase
        .from('chat_participants')
        .select('profile_id')
        .eq('chat_id', chat_id)
        .neq('profile_id', sender_id)
        .limit(1);
      console.log('[FCM-WEBHOOK] chat_participants query:', error ? 'error' : 'ok', 'count:', participants?.length);
      if (!error && participants && participants.length > 0) {
        receiverId = participants[0].profile_id;
      } else if (error) {
        console.error('[FCM-WEBHOOK] chat_participants error:', error.message);
      }
    } catch (err) {
      console.error('[FCM-WEBHOOK] chat_participants exception:', err.message);
    }
  } else {
    console.warn('[FCM-WEBHOOK] supabase client not initialized (missing SUPABASE_SERVICE_KEY)');
  }

  if (!receiverId) {
    console.warn('[FCM-WEBHOOK] no receiver found for chat_id:', chat_id);
    return res.status(200).json({ ok: true, skipped: 'no receiver found' });
  }
  console.log('[FCM-WEBHOOK] receiverId:', receiverId);

  // Get sender's name
  let senderName = 'RED ON';
  if (supabase) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', sender_id)
        .single();
      if (!error && profile && profile.name) {
        senderName = profile.name;
        console.log('[FCM-WEBHOOK] sender name:', senderName);
      } else if (error) {
        console.warn('[FCM-WEBHOOK] profile fetch error:', error.message);
      }
    } catch (err) {
      console.warn('[FCM-WEBHOOK] profile fetch exception:', err.message);
    }
  }

  // Get receiver's push tokens
  console.log('[FCM-WEBHOOK] fetching tokens for receiver:', receiverId);
  const tokens = await getTokens(receiverId);
  console.log('[FCM-WEBHOOK] tokens found:', tokens.length);
  if (!tokens.length) {
    console.warn('[FCM-WEBHOOK] no push tokens for receiver — cannot send push');
    return res.status(200).json({ ok: true, sent: 0, reason: 'no tokens for receiver' });
  }

  const results = { web: 0, android: 0, errors: 0 };

  for (const t of tokens) {
    console.log('[FCM-WEBHOOK] sending to device:', t.device, 'token preview:', t.token.substring(0, 20) + '...');
    if (t.device === 'android-fcm' || t.device === 'android') {
      const admin = await initFirebaseAdmin();
      if (admin) {
        console.log('[FCM-WEBHOOK] Firebase Admin initialized, sending FCM message...');
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
          const response = await admin.messaging().send(message);
          console.log('[FCM-WEBHOOK] FCM send success:', response);
          results.android++;
        } catch (err) {
          console.error('[FCM-WEBHOOK] FCM send error:', err.message, err.code || '');
          results.errors++;
        }
      } else {
        console.error('[FCM-WEBHOOK] Firebase Admin not available (check FIREBASE_SERVICE_ACCOUNT)');
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
        console.log('[FCM-WEBHOOK] Web push success');
        results.web++;
      } catch (err) {
        console.error('[FCM-WEBHOOK] Web push error:', err.message);
        results.errors++;
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log('[FCM-WEBHOOK] done in', elapsed, 'ms — results:', JSON.stringify(results));
  res.json({ ok: true, ...results });
});

export default router;
