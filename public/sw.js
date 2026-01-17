// Service Worker for PWA + Push Notifications
const CACHE_NAME = 'blockhunter-v3'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg'
]

// Install - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => { }) // Ignore cache errors on install
  )
  self.skipWaiting()
})

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch - Safari-friendly error handling
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)

  // Skip cross-origin requests (external APIs)
  if (url.origin !== self.location.origin) return

  // API calls -> Network only, no caching
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
    return
  }

  // Data files -> Network first, cache fallback
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => { })
          }
          return response
        })
        .catch(() => caches.match(event.request).then(r => r || new Response('{}', { status: 200 })))
    )
    return
  }

  // Next.js chunks and navigation -> Network first
  if (url.pathname.startsWith('/_next/') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  // Static assets -> Cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => { })
          }
          return response
        })
        .catch(() => new Response('', { status: 404 }))
    })
  )
})

// Push Notification handler - iOS Safari compatible
self.addEventListener('push', (event) => {
  let data = {
    title: 'BlockHunter Alert',
    body: 'New signal detected!',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'blockhunter-' + Date.now(),
    data: {}
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {}
      }
    } catch {
      data.body = event.data.text() || data.body
    }
  }

  // Safari-optimized notification options
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    renotify: true,
    requireInteraction: false, // iOS requires false
    silent: false,
    data: data.data
  }

  // Add vibrate only if supported (not iOS)
  if ('vibrate' in navigator) {
    options.vibrate = [200, 100, 200]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click handler - Safari compatible
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => {
            if (urlToOpen !== '/') c.navigate(urlToOpen)
            return c
          })
        }
      }
      // Open new window
      return clients.openWindow(urlToOpen)
    })
  )
})

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true
    }).then((subscription) => {
      // Re-subscribe to server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      })
    }).catch(() => {
      console.log('Push re-subscription failed')
    })
  )
})
