import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const isNative = Capacitor.isNativePlatform();

function getServerUrl(): string | null {
  return import.meta.env.VITE_SERVER_URL || null;
}

const PUSH_TOKEN_KEY = 'redon_push_token';

function registerTokenWithServer(token: string, userId: string) {
  const baseUrl = getServerUrl();
  if (!baseUrl) return;
  fetch(`${baseUrl}/api/fcm/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: userId, token, device: 'android-fcm' }),
  }).then(res => {
    if (!res.ok) console.warn('[PUSH] register failed:', res.status);
  }).catch(() => {});
}

export async function setupCapacitorPush(userId: string) {
  if (!isNative) return;

  try {
    try {
      await PushNotifications.createChannel({
        id: 'redon-messages',
        name: 'Mensajes',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
      });
      await PushNotifications.createChannel({
        id: 'redon-calls',
        name: 'Llamadas',
        importance: 5,
        visibility: 1,
        sound: 'ringtone',
        vibration: true,
        lights: true,
      });
    } catch {}

    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token: any) => {
      const pushToken = token.value;
      try { localStorage.setItem(PUSH_TOKEN_KEY, pushToken); } catch {}
      registerTokenWithServer(pushToken, userId);
    });

    PushNotifications.addListener('registrationError', () => {});

    try {
      const savedToken = localStorage.getItem(PUSH_TOKEN_KEY);
      if (savedToken) {
        registerTokenWithServer(savedToken, userId);
      }
    } catch {}

    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      const data = notification.data;
      if (data?.type === 'call' && data?.chatId) {
        window.dispatchEvent(new CustomEvent('incoming-call', {
          detail: { chatId: data.chatId, callerId: data.callerId, callerName: data.callerName, callType: data.callType || 'audio' },
        }));
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      const data = action.notification.data;
      if (!data) return;
      if (data.type === 'call' && data.chatId) {
        window.dispatchEvent(new CustomEvent('incoming-call', {
          detail: { chatId: data.chatId, callerId: data.callerId, callerName: data.callerName || 'Llamada entrante', callType: data.callType || 'audio' },
        }));
      } else if (data.chatId) {
        if (data.contactId) {
          window.dispatchEvent(new CustomEvent('open-chat', {
            detail: { chatId: data.chatId, contactId: data.contactId },
          }));
        }
      }
    });
  } catch (e) {
    console.warn('FCM setup failed:', e);
  }
}

export async function sendFcmPush(profileId: string, title: string, body: string, data?: Record<string, string>) {
  const baseUrl = getServerUrl();
  if (!baseUrl) return;
  fetch(`${baseUrl}/api/fcm/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: profileId, title, body, data }),
  }).catch(() => {});
}
