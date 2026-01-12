import { NextRequest, NextResponse } from 'next/server'

// Cache prices for 30 seconds
interface CachedStock {
  price: number
  change: number
  changeAmount: number
  name?: string
  exchange?: string
  previousClose: number
  timestamp: number
}

const priceCache = new Map<string, CachedStock>()
const CACHE_TTL = 30 * 1000 // 30 seconds

// Get exchange from symbol
function getExchange(symbol: string, exchangeName?: string): string {
  if (symbol.endsWith('-USD')) return 'Crypto'
  if (exchangeName) {
    if (exchangeName.includes('NASDAQ') || exchangeName === 'NMS' || exchangeName === 'NGM' || exchangeName === 'NCM') return 'NASDAQ'
    if (exchangeName.includes('NYSE') || exchangeName === 'NYQ') return 'NYSE'
    if (exchangeName === 'LSE') return 'LSE'
  }
  return 'US'
}

// Use Yahoo Finance v6 quote API for accurate daily change
async function fetchQuote(symbol: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${symbol}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
  )
  
  const data = await res.json()
  const quote = data.quoteResponse?.result?.[0]
  
  if (!quote) return null
  
  return {
    price: quote.regularMarketPrice,
    change: quote.regularMarketChangePercent, // Daily % change (vs previous close)
    changeAmount: quote.regularMarketChange,   // Daily $ change
    previousClose: quote.regularMarketPreviousClose,
    name: quote.shortName || quote.longName || symbol,
    exchange: getExchange(symbol, quote.exchange)
  }
}

// Fallback to chart API if quote fails
async function fetchChart(symbol: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
  )
  
  const data = await res.json()
  const meta = data.chart?.result?.[0]?.meta
  
  if (!meta) return null
  
  const price = meta.regularMarketPrice
  const prevClose = meta.previousClose || meta.chartPreviousClose
  const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
  const changeAmount = prevClose ? price - prevClose : 0
  
  return {
    price,
    change,
    changeAmount,
    previousClose: prevClose,
    name: meta.shortName || meta.longName || symbol,
    exchange: getExchange(symbol, meta.exchangeName)
  }
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
      changeAmount: cached.changeAmount,
      previousClose: cached.previousClose,
      name: cached.name,
      exchange: cached.exchange,
      cached: true
    })
  }
  
  try {
    // Try quote API first (more accurate)
    let result = await fetchQuote(upperSymbol)
    
    // Fallback to chart API
    if (!result) {
      result = await fetchChart(upperSymbol)
    }
    
    if (!result) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 })
    }
    
    // Update cache
    priceCache.set(upperSymbol, { 
      ...result, 
      timestamp: Date.now() 
    })
    
    return NextResponse.json({
      symbol: upperSymbol,
      price: result.price,
      change: Math.round(result.change * 100) / 100,
      changeAmount: Math.round(result.changeAmount * 100) / 100,
      previousClose: result.previousClose,
      name: result.name,
      exchange: result.exchange
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}

// Batch endpoint for multiple symbols
export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json()
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'Symbols array required' }, { status: 400 })
    }
    
    const results: Record<string, { 
      price: number
      change: number
      changeAmount: number
      previousClose: number
      name?: string
      exchange?: string 
    }> = {}
    
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
            changeAmount: cached.changeAmount,
            previousClose: cached.previousClose,
            name: cached.name,
            exchange: cached.exchange
          }
        }
        
        try {
          // Try quote API first
          let result = await fetchQuote(upperSymbol)
          
          // Fallback to chart API
          if (!result) {
            result = await fetchChart(upperSymbol)
          }
          
          if (result) {
            priceCache.set(upperSymbol, { 
              ...result, 
              timestamp: Date.now() 
            })
            return { 
              symbol: upperSymbol, 
              price: result.price, 
              change: Math.round(result.change * 100) / 100,
              changeAmount: Math.round(result.changeAmount * 100) / 100,
              previousClose: result.previousClose,
              name: result.name,
              exchange: result.exchange
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
          changeAmount: r.changeAmount,
          previousClose: r.previousClose,
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
