import { NextRequest, NextResponse } from 'next/server'
import { getCachedSMC, setCachedSMC, getAllWatchedSymbols, initDatabase } from '@/lib/db'

// Get SMC data - uses cache, shared across all users
export async function GET(request: NextRequest) {
  try {
    await initDatabase()
    
    const { searchParams } = new URL(request.url)
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || []
    
    if (symbols.length === 0) {
      // Return all cached symbols
      const allSymbols = await getAllWatchedSymbols()
      const results: Record<string, unknown> = {}
      
      for (const symbol of allSymbols) {
        const cached = await getCachedSMC(symbol)
        if (cached) {
          results[symbol] = cached.data
        }
      }
      
      return NextResponse.json({ stocks: results })
    }
    
    // Get specific symbols
    const results: Record<string, unknown> = {}
    const missing: string[] = []
    
    for (const symbol of symbols) {
      const cached = await getCachedSMC(symbol.toUpperCase())
      if (cached) {
        // Check if cache is fresh (< 15 min)
        const age = Date.now() - new Date(cached.updatedAt as string).getTime()
        if (age < 15 * 60 * 1000) {
          results[symbol] = cached.data
          continue
        }
      }
      missing.push(symbol)
    }
    
    return NextResponse.json({ 
      stocks: results,
      missing, // Client can request fresh data for these
      cached: true
    })
  } catch (error) {
    console.error('Get SMC data error:', error)
    return NextResponse.json({ error: 'Failed to get data' }, { status: 500 })
  }
}

// Update SMC cache (called by backend script)
export async function POST(request: NextRequest) {
  try {
    await initDatabase()
    
    // Simple API key auth for backend
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { symbol, data } = await request.json()
    
    if (!symbol || !data) {
      return NextResponse.json({ error: 'Symbol and data required' }, { status: 400 })
    }
    
    await setCachedSMC(symbol.toUpperCase(), data)
    
    return NextResponse.json({ message: 'Cache updated', symbol })
  } catch (error) {
    console.error('Update SMC cache error:', error)
    return NextResponse.json({ error: 'Failed to update cache' }, { status: 500 })
  }
}

// Batch update (for backend script)
export async function PUT(request: NextRequest) {
  try {
    await initDatabase()
    
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { stocks } = await request.json()
    
    if (!stocks || typeof stocks !== 'object') {
      return NextResponse.json({ error: 'Stocks object required' }, { status: 400 })
    }
    
    const updated: string[] = []
    for (const [symbol, data] of Object.entries(stocks)) {
      await setCachedSMC(symbol.toUpperCase(), data as object)
      updated.push(symbol)
    }
    
    return NextResponse.json({ message: 'Batch update complete', updated })
  } catch (error) {
    console.error('Batch update error:', error)
    return NextResponse.json({ error: 'Failed to batch update' }, { status: 500 })
  }
}
