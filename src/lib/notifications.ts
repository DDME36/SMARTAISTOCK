// Push Notification utilities

let swRegistration: ServiceWorkerRegistration | null = null
let isRegistering = false

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  // Return existing registration if available
  if (swRegistration) {
    return swRegistration
  }

  // Prevent multiple simultaneous registrations
  if (isRegistering) {
    return null
  }

  try {
    isRegistering = true
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    return swRegistration
  } catch (error) {
    console.error('SW registration failed:', error)
    return null
  } finally {
    isRegistering = false
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function showLocalNotification(
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> {
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return

  const registration = await navigator.serviceWorker.ready

  await registration.showNotification(title, {
    body,
    icon: '/icon.svg',
    badge: '/favicon.svg',
    tag: 'smc-alert',
    renotify: true,
    ...options
  } as NotificationOptions)
}

// Check alerts and show notifications - ONLY Order Block entries
export async function checkAndNotifyAlerts(
  watchlist: string[],
  smcData: unknown,
  notifiedAlerts: Set<string>
): Promise<Set<string>> {
  if (!smcData || typeof smcData !== 'object' || !('stocks' in smcData)) return notifiedAlerts

  const data = smcData as { stocks: Record<string, { alerts?: Array<{ message: string; signal: string; type?: string }> }> }
  const stocks = data.stocks
  const newNotified = new Set(notifiedAlerts)

  for (const symbol of watchlist) {
    const stock = stocks[symbol]
    if (!stock?.alerts?.length) continue

    for (const alert of stock.alerts) {
      // ONLY notify for Order Block entries (Discount Zone / Premium Zone)
      const isOrderBlockEntry = 
        alert.message?.toLowerCase().includes('order block') ||
        alert.message?.toLowerCase().includes('discount zone') ||
        alert.message?.toLowerCase().includes('premium zone') ||
        alert.message?.toLowerCase().includes('bullish ob') ||
        alert.message?.toLowerCase().includes('bearish ob') ||
        alert.type === 'entry'
      
      if (!isOrderBlockEntry) continue
      
      const alertKey = `${symbol}-${alert.message}`
      
      // Skip if already notified
      if (notifiedAlerts.has(alertKey)) continue

      // Show notification
      const emoji = alert.signal === 'BUY' ? '🟢' : '🔴'
      await showLocalNotification(
        `${emoji} ${symbol} Alert`,
        alert.message,
        { tag: alertKey }
      )

      newNotified.add(alertKey)
    }
  }

  return newNotified
}

// Schedule periodic background sync (if supported)
export async function scheduleBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    // @ts-expect-error - sync is not in types
    await registration.sync.register('check-alerts')
  } catch {
    // Silently fail - background sync is optional
  }
}
