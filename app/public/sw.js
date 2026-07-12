const CACHE_NAME = 'shop2bhutan-runtime-v2'
const APP_SHELL = '/'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(APP_SHELL)).catch(() => undefined)
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Network-first for app routes. This prevents old cached pages from showing
  // a blank screen after new deployments, while still giving basic offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy)).catch(() => undefined)
          return response
        })
        .catch(() => caches.match(APP_SHELL))
    )
    return
  }

  // Network-first for build assets. If the phone has an old asset cached,
  // try network first so the newest Vercel build wins.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() => caches.match(request))
    )
  }
})