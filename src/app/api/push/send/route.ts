import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getAllPushSubscriptions, getUserWatchlist, initDatabase } from '@/lib/db'

// Configure web-push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@blockhunter.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

interface Alert {
  symbol: string
  type: string
  message: string
  signal: string
  ob_high?: number
  ob_low?: number
}

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    await initDatabase()

    const { alerts } = await request.json() as { alerts: Alert[] }
    
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return NextResponse.json({ message: 'No alerts to send' })
    }

    // Get all subscriptions with user info
    const subscriptions = await getAllPushSubscriptions()
    
    if (subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found' })
    }

    let sent = 0
    let failed = 0

    for (const { subscription, userId } of subscriptions) {
      // Get user's watchlist
      const watchlist = await getUserWatchlist(userId)
      
      // Filter alerts for this user's watchlist
      const userAlerts = alerts.filter(alert => watchlist.includes(alert.symbol))
      
      if (userAlerts.length === 0) continue

      // Send notification for each alert
      for (const alert of userAlerts) {
        const emoji = alert.signal === 'BUY' ? '🟢' : '🔴'
        const payload = JSON.stringify({
          title: `${emoji} ${alert.symbol} Order Block!`,
          body: alert.message,
          icon: '/icon.svg',
          badge: '/favicon.svg',
          tag: `${alert.symbol}-${alert.type}`,
          data: {
            symbol: alert.symbol,
            type: alert.type,
            url: '/'
          }
        })

        try {
          await webpush.sendNotification(subscription, payload)
          sent++
        } catch (error: unknown) {
          const pushError = error as { statusCode?: number }
          // Remove invalid subscriptions
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            // Subscription expired or invalid - could remove from DB here
            console.log('Subscription expired:', subscription.endpoint)
          }
          failed++
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      sent, 
      failed,
      totalSubscriptions: subscriptions.length 
    })
  } catch (error) {
    console.error('Push send error:', error)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
