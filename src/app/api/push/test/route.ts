import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getPushSubscription, initDatabase } from '@/lib/db'

// Configure web-push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@smartaistock.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check VAPID keys
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ 
        error: 'VAPID keys not configured',
        debug: {
          hasPublicKey: !!vapidPublicKey,
          hasPrivateKey: !!vapidPrivateKey
        }
      }, { status: 500 })
    }

    await initDatabase()

    // Get user's push subscription from database
    const subscription = await getPushSubscription(payload.id)
    
    if (!subscription) {
      return NextResponse.json({ 
        error: 'No subscription found',
        message: 'กรุณาเปิดการแจ้งเตือนก่อน',
        debug: { userId: payload.id }
      }, { status: 404 })
    }

    // Send test push notification via web-push
    const pushPayload = JSON.stringify({
      title: '🔔 Server Push Test',
      body: 'การแจ้งเตือนจาก Server ทำงานได้!',
      icon: '/icon.svg',
      badge: '/favicon.svg',
      tag: 'server-test',
      data: {
        type: 'test',
        url: '/',
        timestamp: Date.now()
      }
    })

    try {
      await webpush.sendNotification(subscription, pushPayload)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Push notification sent from server!',
        debug: {
          userId: payload.id,
          endpoint: subscription.endpoint.substring(0, 50) + '...'
        }
      })
    } catch (pushError: unknown) {
      const error = pushError as { statusCode?: number; message?: string }
      
      return NextResponse.json({ 
        error: 'Push failed',
        message: error.message,
        statusCode: error.statusCode,
        debug: {
          hint: error.statusCode === 410 ? 'Subscription expired - re-enable notifications' :
                error.statusCode === 401 ? 'VAPID key mismatch' : 'Unknown error'
        }
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Test push error:', error)
    return NextResponse.json({ 
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
