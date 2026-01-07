import { NextRequest, NextResponse } from 'next/server'
import { getCachedSentiment, setCachedSentiment, initDatabase } from '@/lib/db'

// Get market sentiment - shared across all users
export async function GET() {
  try {
    await initDatabase()
    
    const cached = await getCachedSentiment()
    
    if (cached) {
      const age = Date.now() - new Date(cached.updatedAt as string).getTime()
      return NextResponse.json({ 
        sentiment: cached.data,
        cached: true,
        age: Math.round(age / 1000) // seconds
      })
    }
    
    return NextResponse.json({ sentiment: null, cached: false })
  } catch (error) {
    console.error('Get sentiment error:', error)
    return NextResponse.json({ error: 'Failed to get sentiment' }, { status: 500 })
  }
}

// Update sentiment cache (called by backend script)
export async function POST(request: NextRequest) {
  try {
    await initDatabase()
    
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { sentiment } = await request.json()
    
    if (!sentiment) {
      return NextResponse.json({ error: 'Sentiment data required' }, { status: 400 })
    }
    
    await setCachedSentiment(sentiment)
    
    return NextResponse.json({ message: 'Sentiment cache updated' })
  } catch (error) {
    console.error('Update sentiment error:', error)
    return NextResponse.json({ error: 'Failed to update sentiment' }, { status: 500 })
  }
}
