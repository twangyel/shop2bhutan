/*
Merge these fields into the existing background-message handler in
public/firebase-messaging-sw.js. Do not replace your Firebase configuration.

The updated send-push-notification Edge Function sends PWA messages as
DATA-ONLY payloads with data.image when a promotion image exists.
*/

// Inside your existing messaging.onBackgroundMessage((payload) => { ... }):
const data = payload?.data || {};
const title = data.title || 'Shop2Bhutan';
const options = {
  body: data.body || data.message || 'You have a new Shop2Bhutan update.',
  icon: data.icon || '/brand/logo-mark.png',
  badge: data.badge || '/notification-badge-96.png',
  image: data.image || undefined,
  tag: data.tag || data.notification_id || 'shop2bhutan-update',
  data: {
    link: data.link || '/notifications',
    notification_id: data.notification_id || '',
    type: data.type || 'system',
  },
};

self.registration.showNotification(title, options);
