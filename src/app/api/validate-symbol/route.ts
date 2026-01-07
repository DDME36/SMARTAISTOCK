import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')
  
  if (!symbol) {
    return NextResponse.json({ valid: false, error: 'Symbol required' }, { status: 400 })
  }
  
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    )
    
    const data = await res.json()
    
    if (data.chart?.error || !data.chart?.result?.[0]) {
      return NextResponse.json({ valid: false, error: 'Symbol not found' })
    }
    
    const meta = data.chart.result[0].meta
    return NextResponse.json({
      valid: true,
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency
    })
  } catch (error) {
    // If Yahoo fails, still allow the symbol (will be validated by backend later)
    return NextResponse.json({ valid: true, name: symbol.toUpperCase() })
  }
}
