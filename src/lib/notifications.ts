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

  const data = smcData as { 
    stocks: Record<string, { 
      alerts?: Array<{ 
        message: string
        signal: string
        type?: string
        priority?: string
        distance_pct?: number
        ob_type?: string
        ob_high?: number
        ob_low?: number
      }>,
      order_blocks?: Array<{ type: string; signal: string; mid: number; distance_pct: number; in_zone?: boolean; high: number; low: number }>,
      current_price?: number
    }> 
  }
  const stocks = data.stocks
  const newNotified = new Set(notifiedAlerts)

  for (const symbol of watchlist) {
    const stock = stocks[symbol]
    if (!stock?.alerts) continue

    for (const alert of stock.alerts) {
      // ONLY notify for Order Block ENTRY alerts (price is IN the zone)
      const isOBEntry = alert.type?.startsWith('ob_entry_')
      
      if (!isOBEntry) continue
      
      const alertKey = `${symbol}-${alert.type}-${alert.ob_high}-${alert.ob_low}`
      if (notifiedAlerts.has(alertKey)) continue
      
      // Bullish OB = BUY zone (สีเขียว/ฟ้า), Bearish OB = SELL zone (สีแดง)
      const emoji = alert.signal === 'BUY' ? '🟢' : '🔴'
      
      await showLocalNotification(
        `${emoji} ${symbol} เข้าโซน Order Block!`,
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
