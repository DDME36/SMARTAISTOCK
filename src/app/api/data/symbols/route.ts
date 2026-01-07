import { NextRequest, NextResponse } from 'next/server'
import { getAllWatchedSymbols, initDatabase } from '@/lib/db'

// Get all unique symbols from all users' watchlists
// Backend script uses this to know which symbols to fetch
export async function GET(request: NextRequest) {
  try {
    await initDatabase()
    
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const symbols = await getAllWatchedSymbols()
    
    return NextResponse.json({ symbols, count: symbols.length })
  } catch (error) {
    console.error('Get symbols error:', error)
    return NextResponse.json({ error: 'Failed to get symbols' }, { status: 500 })
  }
}
