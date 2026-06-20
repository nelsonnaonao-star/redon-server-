import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

let registrationComplete = false;

export async function setupCapacitorPush(userId: string) {
  if (!Capacitor.isNativePlatform()) return;
  if (registrationComplete) return;

  try {
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token: any) => {
      const pushToken = token.value;
      // Save token to our server
      const servers = [
        `http://${localStorage.getItem('redon_server_ip') || 'localhost'}:3001`,
        'https://disciplined-quietude-production-7b38.up.railway.app',
      ];
      for (const url of servers) {
        fetch(`${url}/api/fcm/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: userId, token: pushToken, device: 'android-fcm' }),
        }).catch(() => {});
      }
      registrationComplete = true;
    });

    PushNotifications.addListener('registrationError', () => {});

    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      // Notification is already shown by the system, but we can handle data
      const data = notification.data;
      if (data?.type === 'call' && data?.chatId) {
        // For calls, we might need to navigate to the call screen
        window.dispatchEvent(new CustomEvent('incoming-call', {
          detail: { chatId: data.chatId, callerId: data.callerId, callerName: data.callerName },
        }));
      }
    });
  } catch {}
}

export async function sendFcmPush(profileId: string, title: string, body: string, data?: Record<string, string>) {
  const payload = { profile_id: profileId, title, body, data };
  const servers = [
    `http://${localStorage.getItem('redon_server_ip') || 'localhost'}:3001`,
    'https://disciplined-quietude-production-7b38.up.railway.app',
  ];
  for (const url of servers) {
    fetch(`${url}/api/fcm/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}
