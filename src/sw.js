/* global clients */
const sw = self
const shellCache = 'howsehowld-shell-v1'
const dataCache = 'howsehowld-last-read-v1'
const precacheUrls = self.__WB_MANIFEST.map((entry) => entry.url)

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(shellCache)
      .then((cache) => cache.addAll(precacheUrls))
      .then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim())
})

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin === sw.location.origin && event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(shellCache).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }
  if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/v1/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(dataCache).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => caches.match(event.request)),
    )
  }
})

sw.addEventListener('push', (event) => {
  const payload = event.data?.json?.() ?? {
    title: 'HowseHowld',
    body: event.data?.text?.() ?? 'You have a household update.',
    url: '/',
  }
  event.waitUntil(
    sw.registration.showNotification(payload.title ?? 'HowseHowld', {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url ?? '/' },
    }),
  )
})

sw.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/', sw.location.origin).href
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === sw.location.origin)
      if (existing) {
        existing.navigate(target)
        return existing.focus()
      }
      return clients.openWindow(target)
    }),
  )
})
