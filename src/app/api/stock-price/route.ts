import { NextRequest, NextResponse } from 'next/server'

// Cache prices for 1 minute
interface CachedStock {
  price: number
  change: number
  name?: string
  exchange?: string
  timestamp: number
}

const priceCache = new Map<string, CachedStock>()
const CACHE_TTL = 60 * 1000 // 1 minute

// Get exchange from symbol
function getExchange(symbol: string, currency?: string): string {
  if (symbol.endsWith('-USD')) return 'Crypto'
  if (currency === 'GBP' || currency === 'GBp') return 'LSE'
  if (currency === 'EUR') return 'EU'
  if (currency === 'JPY') return 'TSE'
  // Default to US exchanges
  return 'US'
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')
  
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }
  
  const upperSymbol = symbol.toUpperCase()
  
  // Check cache
  const cached = priceCache.get(upperSymbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      symbol: upperSymbol,
      price: cached.price,
      change: cached.change,
      name: cached.name,
      exchange: cached.exchange,
      cached: true
    })
  }
  
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=2d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 60 }
      }
    )
    
    const data = await res.json()
    
    if (data.chart?.error || !data.chart?.result?.[0]) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 })
    }
    
    const meta = data.chart.result[0].meta
    const price = meta.regularMarketPrice
    const prevClose = meta.previousClose || meta.chartPreviousClose
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
    const name = meta.shortName || meta.longName || upperSymbol
    const exchange = getExchange(upperSymbol, meta.currency)
    
    // Update cache
    priceCache.set(upperSymbol, { price, change, name, exchange, timestamp: Date.now() })
    
    return NextResponse.json({
      symbol: upperSymbol,
      price: price,
      change: Math.round(change * 100) / 100,
      name,
      exchange,
      currency: meta.currency
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}

// Batch endpoint for multiple symbols - now returns name and exchange
export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json()
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'Symbols array required' }, { status: 400 })
    }
    
    const results: Record<string, { price: number; change: number; name?: string; exchange?: string }> = {}
    
    // Fetch in parallel (max 10 at a time)
    const chunks = []
    for (let i = 0; i < symbols.length; i += 10) {
      chunks.push(symbols.slice(i, i + 10))
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (symbol: string) => {
        const upperSymbol = symbol.toUpperCase()
        
        // Check cache first
        const cached = priceCache.get(upperSymbol)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return { 
            symbol: upperSymbol, 
            price: cached.price, 
            change: cached.change,
            name: cached.name,
            exchange: cached.exchange
          }
        }
        
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=2d`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }
          )
          const data = await res.json()
          
          if (data.chart?.result?.[0]) {
            const meta = data.chart.result[0].meta
            const price = meta.regularMarketPrice
            const prevClose = meta.previousClose || meta.chartPreviousClose
            const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
            const name = meta.shortName || meta.longName || upperSymbol
            const exchange = getExchange(upperSymbol, meta.currency)
            
            priceCache.set(upperSymbol, { price, change, name, exchange, timestamp: Date.now() })
            return { 
              symbol: upperSymbol, 
              price, 
              change: Math.round(change * 100) / 100,
              name,
              exchange
            }
          }
        } catch {}
        return null
      })
      
      const chunkResults = await Promise.all(promises)
      chunkResults.forEach(r => {
        if (r) results[r.symbol] = { 
          price: r.price, 
          change: r.change,
          name: r.name,
          exchange: r.exchange
        }
      })
    }
    
    return NextResponse.json({ prices: results })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}
