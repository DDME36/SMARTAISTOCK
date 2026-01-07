import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserSettings, updateUserSettings, initDatabase } from '@/lib/db'

// Get user settings
export async function GET() {
  try {
    await initDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const settings = await getUserSettings(user.id)
    
    return NextResponse.json({ 
      settings: {
        language: settings.language,
        notificationsEnabled: Boolean(settings.notifications_enabled)
      }
    })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 })
  }
}

// Update user settings
export async function PUT(request: NextRequest) {
  try {
    await initDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { language, notificationsEnabled } = await request.json()
    
    await updateUserSettings(user.id, {
      language,
      notifications_enabled: notificationsEnabled
    })
    
    const settings = await getUserSettings(user.id)
    
    return NextResponse.json({ 
      settings: {
        language: settings.language,
        notificationsEnabled: Boolean(settings.notifications_enabled)
      },
      message: 'Settings updated'
    })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
