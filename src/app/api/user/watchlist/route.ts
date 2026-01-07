import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserWatchlist, addToWatchlist, removeFromWatchlist, initDatabase } from '@/lib/db'

// Get user's watchlist
export async function GET() {
  try {
    await initDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const watchlist = await getUserWatchlist(user.id)
    return NextResponse.json({ watchlist })
  } catch (error) {
    console.error('Get watchlist error:', error)
    return NextResponse.json({ error: 'Failed to get watchlist' }, { status: 500 })
  }
}

// Add symbol to watchlist
export async function POST(request: NextRequest) {
  try {
    await initDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { symbol } = await request.json()
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
    }
    
    await addToWatchlist(user.id, symbol)
    const watchlist = await getUserWatchlist(user.id)
    
    return NextResponse.json({ watchlist, message: 'Symbol added' })
  } catch (error) {
    console.error('Add to watchlist error:', error)
    return NextResponse.json({ error: 'Failed to add symbol' }, { status: 500 })
  }
}

// Remove symbol from watchlist
export async function DELETE(request: NextRequest) {
  try {
    await initDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { symbol } = await request.json()
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
    }
    
    await removeFromWatchlist(user.id, symbol)
    const watchlist = await getUserWatchlist(user.id)
    
    return NextResponse.json({ watchlist, message: 'Symbol removed' })
  } catch (error) {
    console.error('Remove from watchlist error:', error)
    return NextResponse.json({ error: 'Failed to remove symbol' }, { status: 500 })
  }
}
