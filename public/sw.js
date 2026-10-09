// public/sw.js — offline shell + push reminders
const CACHE = 'jarvis-v4'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png', '/apple-touch-icon.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})

// Network first, fall back to cache, so the app still opens without signal
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res })
      .catch(() => caches.match(req).then(r => r || caches.match('/')))
  )
})

self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { body: e.data?.text() } }
  e.waitUntil(self.registration.showNotification(data.title || 'JARVIS', {
    body: data.body || 'Open JARVIS to see today’s tasks.',
    tag: data.tag || 'jarvis',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c)
    return open ? open.focus() : self.clients.openWindow('/')
  }))
})
