// Push Notification utilities

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Helper: Promise with timeout
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), ms)
    )
  ])
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('SW registered:', registration.scope)
    return registration
  } catch (error) {
    console.error('SW registration failed:', error)
    return null
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

// Subscribe to push notifications
export async function subscribeToPush(): Promise<boolean> {
  console.log('subscribeToPush called, VAPID_KEY:', VAPID_PUBLIC_KEY ? 'exists' : 'missing')
  
  if (!VAPID_PUBLIC_KEY) {
    console.log('VAPID key not configured')
    return false
  }

  try {
    // Check support
    if (!('Notification' in window)) {
      console.log('Notification API not supported')
      return false
    }
    
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported')
      return false
    }
    
    if (!('PushManager' in window)) {
      console.log('Push API not supported')
      return false
    }

    // Request permission first
    if (Notification.permission === 'denied') {
      console.log('Notifications denied')
      return false
    }
    
    if (Notification.permission !== 'granted') {
      console.log('Requesting permission...')
      const permission = await Notification.requestPermission()
      console.log('Permission result:', permission)
      if (permission !== 'granted') return false
    }

    // Register SW first if needed
    let registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      console.log('Registering service worker...')
      registration = await withTimeout(
        navigator.serviceWorker.register('/sw.js'),
        5000,
        'Service worker registration timeout'
      )
    }
    
    // Wait for SW to be ready with timeout
    console.log('Waiting for SW ready...')
    registration = await withTimeout(
      navigator.serviceWorker.ready,
      5000,
      'Service worker ready timeout'
    )
    console.log('SW ready')
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription()
    console.log('Existing subscription:', subscription ? 'yes' : 'no')
    
    if (!subscription) {
      // Subscribe to push
      console.log('Creating new subscription...')
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource
        }),
        10000,
        'Push subscription timeout'
      )
      console.log('Subscription created')
    }

    // Send subscription to server (uses cookie auth)
    console.log('Sending to server...')
    const response = await withTimeout(
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription })
      }),
      10000,
      'Server request timeout'
    )

    console.log('Server response:', response.status)
    return response.ok
  } catch (error) {
    console.error('Push subscription failed:', error)
    return false
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      5000,
      'SW ready timeout'
    )
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      // Unsubscribe locally
      await subscription.unsubscribe()
      
      // Remove from server (uses cookie auth)
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: subscription.endpoint })
      })
    }

    return true
  } catch (error) {
    console.error('Push unsubscribe failed:', error)
    return false
  }
}

// Check if push is supported and subscribed
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  try {
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      3000,
      'SW ready timeout'
    )
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}

// Helper: Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Show local notification (fallback when app is open)
export async function showLocalNotification(
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> {
  const hasPermission = Notification.permission === 'granted'
  if (!hasPermission) return

  try {
    const registration = await withTimeout(
      navigator.serviceWorker.ready,
      3000,
      'SW ready timeout'
    )

    await registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/favicon.svg',
      tag: 'smc-alert',
      renotify: true,
      ...options
    } as NotificationOptions)
  } catch (error) {
    console.error('showLocalNotification failed:', error)
  }
}

// Test notification - try multiple methods
export async function testNotification(title?: string, body?: string): Promise<boolean> {
  console.log('testNotification called')
  
  const notifTitle = title || '🔔 Test Notification'
  const notifBody = body || 'Push notifications are working! You will receive alerts when stocks enter Order Block zones.'
  
  try {
    // Check permission
    if (!('Notification' in window)) {
      console.log('Notification API not supported')
      return false
    }
    
    if (Notification.permission !== 'granted') {
      console.log('Permission not granted:', Notification.permission)
      return false
    }

    // Method 1: Try via Service Worker (works in PWA)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await withTimeout(
          navigator.serviceWorker.ready,
          3000,
          'SW timeout'
        )
        
        await registration.showNotification(notifTitle, {
          body: notifBody,
          icon: '/icon.svg',
          badge: '/favicon.svg',
          tag: 'test-notification-' + Date.now(),
          vibrate: [200, 100, 200]
        } as NotificationOptions)
        
        console.log('Notification sent via SW')
        return true
      } catch (swError) {
        console.log('SW notification failed:', swError)
      }
    }

    // Method 2: Fallback to basic Notification API
    try {
      const notification = new Notification(notifTitle, {
        body: notifBody,
        icon: '/icon.svg',
        tag: 'test-basic-' + Date.now()
      })
      
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
      
      console.log('Notification sent via basic API')
      return true
    } catch (basicError) {
      console.log('Basic notification failed:', basicError)
    }

    return false
  } catch (error) {
    console.error('Test notification failed:', error)
    return false
  }
}
