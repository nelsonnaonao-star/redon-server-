importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDXVz76GCgNnA9A74p-_g9qt5wX8dFCnjQ',
  projectId: 'red-on-7e788',
  messagingSenderId: '988299578716',
  appId: '1:988299578716:web:df2dfd56b74ccb344a0599',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { notification, data } = payload;
  const title = notification?.title || 'RED ON';
  const body = notification?.body || '';
  const isCall = data?.type === 'call';

  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/badge.png',
    tag: isCall ? 'call' : 'message',
    requireInteraction: isCall,
    data: data || {},
    vibrate: isCall ? [200, 100, 200, 100, 200] : [100, 50, 100],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if (data.type === 'call' && data.chatId) {
    event.waitUntil(clients.openWindow('/'));
  } else if (data.chatId) {
    event.waitUntil(clients.openWindow('/'));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});
