import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserWatchlist, getUserSettings, initDatabase } from '@/lib/db'

export async function GET() {
  try {
    await initDatabase()
    
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ user: null })
    }
    
    // Get user's watchlist and settings
    const [watchlist, settings] = await Promise.all([
      getUserWatchlist(user.id),
      getUserSettings(user.id)
    ])
    
    return NextResponse.json({ 
      user,
      watchlist,
      settings: {
        language: settings.language,
        notificationsEnabled: Boolean(settings.notifications_enabled)
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ user: null })
  }
}
