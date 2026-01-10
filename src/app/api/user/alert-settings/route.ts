import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getAlertSettings, saveAlertSettings, initDatabase, AlertSettings } from '@/lib/db'

export async function GET() {
  try {
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
    const settings = await getAlertSettings(payload.id)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get alert settings error:', error)
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const { settings } = await request.json() as { settings: AlertSettings }
    
    if (!settings) {
      return NextResponse.json({ error: 'Settings required' }, { status: 400 })
    }

    await saveAlertSettings(payload.id, settings)

    return NextResponse.json({ success: true, message: 'Settings saved' })
  } catch (error) {
    console.error('Save alert settings error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
