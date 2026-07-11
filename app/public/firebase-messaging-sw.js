/* Shop2Bhutan Firebase Messaging service worker.
 *
 * The web Firebase configuration is passed as public query parameters when
 * this worker is registered. This avoids hard-coding project values into the
 * repository while still keeping the worker usable from Vercel's public root.
 */

/* Handle notification taps before importing Firebase Messaging, as Firebase
 * recommends for customized click behavior.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notificationData = event.notification.data || {}
  const fcmMessage = notificationData.FCM_MSG || {}
  const fcmData = fcmMessage.data || {}

  const rawLink =
    notificationData.link ||
    notificationData.url ||
    notificationData.action_url ||
    fcmData.link ||
    fcmData.url ||
    fcmData.action_url ||
    '/'

  let targetUrl

  try {
    targetUrl = new URL(rawLink, self.location.origin)
  } catch {
    targetUrl = new URL('/', self.location.origin)
  }

  if (targetUrl.origin !== self.location.origin) {
    targetUrl = new URL('/', self.location.origin)
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          const clientUrl = new URL(client.url)

          if (clientUrl.origin === self.location.origin) {
            client.postMessage({
              type: 'SHOP2BHUTAN_PUSH_OPEN',
              link: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
            })

            if ('focus' in client) {
              await client.focus()
            }

            return
          }
        }

        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl.href)
        }
      }),
  )
})

const params = new URL(self.location.href).searchParams

const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || undefined,
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
}

const hasRequiredConfig =
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId

if (hasRequiredConfig) {
  importScripts(
    'https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js',
  )
  importScripts(
    'https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js',
  )

  firebase.initializeApp(firebaseConfig)

  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    /* Notification payloads are normally displayed automatically by FCM.
     * Only create our own notification for data-only messages to avoid
     * duplicate notifications.
     */
    if (payload.notification) return

    const data = payload.data || {}
    const title = data.title || 'Shop2Bhutan update'
    const body =
      data.body ||
      data.message ||
      'You have a new Shop2Bhutan notification.'

    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag || data.notification_id || undefined,
      renotify: false,
      data: {
        ...data,
        link: data.link || data.url || data.action_url || '/',
      },
    })
  })
} else {
  console.error(
    '[firebase-messaging-sw] Firebase web configuration is incomplete.',
  )
}
