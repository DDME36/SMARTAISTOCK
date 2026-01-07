// Service Worker for PWA + Push Notifications
const CACHE_NAME = 'blockhunter-v1'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg'
]

// Install - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
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

// Fetch - Strategy based on request type
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // 1. Data files and API calls -> Network First
  if (url.pathname.includes('/data/') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache only if valid and not an API error
          if (response.ok && url.pathname.includes('/data/')) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Fallback to cache for data files only
          if (url.pathname.includes('/data/')) {
            return caches.match(event.request)
          }
        })
    )
    return
  }

  // 2. Next.js internals (JS/CSS chunks) and Navigation (HTML) -> Network First
  // We want to ensure we always get the latest app logic and HTML
  if (url.pathname.startsWith('/_next/') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Optional: Provide offline fallback for navigation here if desired
        return caches.match(event.request)
      })
    )
    return
  }

  // 3. Static assets (images, icons, etc.) -> Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache new static assets
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
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

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: 'smc-alert',
    renotify: true,
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      return clients.openWindow(event.notification.data || '/')
    })
  )
})

// Background sync for checking alerts
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-alerts') {
    event.waitUntil(checkForAlerts())
  }
})

async function checkForAlerts() {
  try {
    const response = await fetch('/data/smc_data.json')
    const data = await response.json()

    // Get user's watchlist from IndexedDB or use default
    const watchlist = await getWatchlistFromIDB()

    // Check for alerts in user's watchlist
    const alerts = []
    for (const symbol of watchlist) {
      const stock = data.stocks?.[symbol]
      if (stock?.alerts?.length > 0) {
        for (const alert of stock.alerts) {
          alerts.push({ symbol, ...alert })
        }
      }
    }

    // Show notification if there are alerts
    if (alerts.length > 0) {
      const alert = alerts[0]
      await self.registration.showNotification(`🚨 ${alert.symbol} Alert`, {
        body: alert.message,
        icon: '/icon.svg',
        badge: '/favicon.svg',
        tag: `alert-${alert.symbol}`,
        vibrate: [200, 100, 200]
      })
    }
  } catch (error) {
    console.error('Error checking alerts:', error)
  }
}

async function getWatchlistFromIDB() {
  // Default watchlist if IDB not available
  return ['AAPL', 'TSLA', 'NVDA']
}
