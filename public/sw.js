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
      .catch(() => {}) // Ignore cache errors on install
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
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {})
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
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {})
          }
          return response
        })
        .catch(() => new Response('', { status: 404 }))
    })
  )
})

// Push Notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'BlockHunter', body: 'New signal detected!' }

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      badge: '/favicon.svg',
      tag: 'smc-alert',
      renotify: true
    })
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('/')
    })
  )
})
