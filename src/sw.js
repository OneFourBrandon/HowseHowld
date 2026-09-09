/* global clients */
const sw = self
const shellCache = 'howsehowld-shell-v1'
// The build can list icons both as assets and as manifest entries. Cache.addAll
// rejects the entire install if any request URL appears more than once.
const precacheUrls = [...new Set(self.__WB_MANIFEST.map((entry) =>
  new URL(entry.url, sw.location.href).href,
))]

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(shellCache)
      .then((cache) => cache.addAll(precacheUrls))
      .then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (event) => {
  // Do not replay authenticated database responses from a different session.
  event.waitUntil(caches.delete('howsehowld-last-read-v1').then(() => sw.clients.claim()))
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
