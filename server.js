import express from 'express';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize Firebase Admin SDK for FCM
const serviceAccountPath = join(__dirname, 'red-on-7e788-firebase-adminsdk-fbsvc-801e8d6528.json');
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch {
  console.warn('Firebase Admin SDK not initialized — FCM native push unavailable');
}

const VAPID_PUBLIC_KEY = process.env.VITE_FIREBASE_VAPID_KEY;
const VAPID_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_VAPID_KEY || '';

webpush.setVapidDetails(
  'mailto:admin@redon.app',
  VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY
);

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/fcm/register', async (req, res) => {
  const { profile_id, token } = req.body;
  if (!profile_id || !token) {
    return res.status(400).json({ error: 'profile_id and token required' });
  }
  const { error } = await supabase
    .from('fcm_tokens')
    .upsert(
      { profile_id, token, device: 'web', updated_at: new Date().toISOString() },
      { onConflict: 'token' }
    );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/fcm/unregister', async (req, res) => {
  const { token } = req.body;
  await supabase.from('fcm_tokens').delete().eq('token', token);
  res.json({ success: true });
});

app.post('/api/fcm/send', async (req, res) => {
  const { profile_id, title, body, data } = req.body;
  if (!profile_id || !title) {
    return res.status(400).json({ error: 'profile_id and title required' });
  }

  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('token, device')
    .eq('profile_id', profile_id);

  if (!tokens || tokens.length === 0) {
    return res.status(404).json({ error: 'No subscriptions' });
  }

  const results = [];
  for (const t of tokens) {
    const isFCM = t.device === 'android-fcm';

    if (isFCM && admin.apps.length) {
      // Send via Firebase Admin SDK (native Android push)
      try {
        await admin.messaging().send({
          token: t.token,
          notification: { title, body: body || '' },
          data: { ...(data || {}), click_action: 'OPEN_APP' },
          android: { priority: 'high', notification: { channelId: 'redon-messages', sound: 'default' } },
        });
        results.push({ success: true, method: 'fcm' });
      } catch (err: any) {
        if (err.code === 'messaging/registration-token-not-registered') {
          await supabase.from('fcm_tokens').delete().eq('token', t.token);
        }
        results.push({ success: false, method: 'fcm', error: String(err) });
      }
    } else {
      // Send via Web Push (VAPID) for browser/webview
      try {
        const subscription = JSON.parse(t.token);
        await webpush.sendNotification(subscription, JSON.stringify({
          title, body: body || '', icon: '/icon.png', badge: '/badge.png', data: data || {},
        }));
        results.push({ success: true, method: 'webpush' });
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('fcm_tokens').delete().eq('token', t.token);
        }
        results.push({ success: false, method: 'webpush', error: String(err) });
      }
    }
  }

  res.json({ success: true, results });
});

const PORT = process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Push server running on port ${PORT}`);
});
