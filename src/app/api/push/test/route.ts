import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import webpush from 'web-push'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getUserPushSubscriptions, initDatabase } from '@/lib/db'

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

/**
 * POST /api/push/test
 * ทดสอบส่ง push notification จริงๆ จาก server
 * ใช้สำหรับ debug ว่า subscription ทำงานหรือไม่
 */
export async function POST(request: NextRequest) {
    try {
        // Debug: Log VAPID status
        console.log('=== Push Test Debug ===')
        console.log('VAPID Public Key:', vapidPublicKey ? 'SET' : 'MISSING')
        console.log('VAPID Private Key:', vapidPrivateKey ? 'SET' : 'MISSING')

        // Verify auth from cookie
        const cookieStore = await cookies()
        const token = cookieStore.get(COOKIE_NAME)?.value

        if (!token) {
            console.log('Auth: No token found')
            return NextResponse.json({ error: 'Unauthorized', debug: 'No token' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload) {
            console.log('Auth: Invalid token')
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        console.log('Auth: User ID', payload.id)

        if (!vapidPublicKey || !vapidPrivateKey) {
            return NextResponse.json({
                error: 'VAPID keys not configured',
                debug: {
                    publicKey: !!vapidPublicKey,
                    privateKey: !!vapidPrivateKey
                }
            }, { status: 500 })
        }

        await initDatabase()

        // Get user's push subscriptions
        const subscriptions = await getUserPushSubscriptions(payload.id)
        console.log('Subscriptions found:', subscriptions.length)

        if (subscriptions.length === 0) {
            return NextResponse.json({
                error: 'No push subscriptions found',
                debug: {
                    userId: payload.id,
                    message: 'ไม่พบ subscription - ลองปิดแล้วเปิด notification ใหม่'
                }
            }, { status: 404 })
        }

        // Send test notification to all user's subscriptions
        const results = []
        for (const subscription of subscriptions) {
            const notificationPayload = JSON.stringify({
                title: '🧪 Server Push Test',
                body: `ทดสอบจาก server สำเร็จ! (${new Date().toLocaleTimeString('th-TH')})`,
                icon: '/icon.svg',
                badge: '/favicon.svg',
                tag: 'server-test-' + Date.now(),
                data: {
                    type: 'test',
                    timestamp: Date.now()
                }
            })

            try {
                console.log('Sending to endpoint:', subscription.endpoint.substring(0, 50) + '...')
                await webpush.sendNotification(subscription, notificationPayload)
                results.push({
                    endpoint: subscription.endpoint.substring(0, 50) + '...',
                    status: 'success'
                })
                console.log('Push sent successfully!')
            } catch (error: unknown) {
                const pushError = error as { statusCode?: number; message?: string }
                console.error('Push error:', pushError.statusCode, pushError.message)
                results.push({
                    endpoint: subscription.endpoint.substring(0, 50) + '...',
                    status: 'failed',
                    error: pushError.statusCode,
                    message: pushError.message
                })
            }
        }

        const successCount = results.filter(r => r.status === 'success').length
        const failedCount = results.filter(r => r.status === 'failed').length

        return NextResponse.json({
            success: successCount > 0,
            message: successCount > 0
                ? `ส่ง push สำเร็จ ${successCount} รายการ`
                : 'ส่ง push ไม่สำเร็จ',
            results,
            debug: {
                userId: payload.id,
                totalSubscriptions: subscriptions.length,
                sent: successCount,
                failed: failedCount
            }
        })

    } catch (error) {
        console.error('Push test error:', error)
        return NextResponse.json({
            error: 'Failed to send test push',
            detail: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}

/**
 * GET /api/push/test
 * ตรวจสอบสถานะ push subscription ของ user
 */
export async function GET(request: NextRequest) {
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

        await initDatabase()

        const subscriptions = await getUserPushSubscriptions(payload.id)

        return NextResponse.json({
            userId: payload.id,
            subscriptionCount: subscriptions.length,
            subscriptions: subscriptions.map(s => ({
                endpoint: s.endpoint?.substring(0, 60) + '...',
                hasKeys: !!(s.keys?.p256dh && s.keys?.auth)
            })),
            vapidConfigured: !!(vapidPublicKey && vapidPrivateKey)
        })

    } catch (error) {
        console.error('Push status error:', error)
        return NextResponse.json({
            error: 'Failed to get push status'
        }, { status: 500 })
    }
}
