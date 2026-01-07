import { NextRequest, NextResponse } from 'next/server'

// SMC Calculator - On-Demand Analysis
// Calculates Order Blocks, BOS, and alerts for any stock symbol

interface Candle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  date: string
}

interface OrderBlock {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  volume: number
  date: string
  strength: number
  tested: boolean
}

interface SMCResult {
  symbol: string
  current_price: number
  trend: 'bullish' | 'bearish' | 'neutral'
  order_blocks: OrderBlock[]
  bos_levels: { price: number; type: string; date: string }[]
  fvg_zones: { top: number; bottom: number; type: string }[]
  alerts: { type: string; message: string; price: number }[]
  support: number | null
  resistance: number | null
  price_target: number | null
  stop_loss: number | null
  generated_at: string
}

// Fetch candle data from Yahoo Finance
async function fetchCandles(symbol: string, interval: string = '1h'): Promise<Candle[]> {
  const range = interval === '1wk' ? '2y' : interval === '1d' ? '1y' : '3mo'
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 300 } // Cache 5 minutes
  })
  
  if (!res.ok) throw new Error(`Failed to fetch ${symbol}`)
  
  const data = await res.json()
  const result = data.chart?.result?.[0]
  
  if (!result?.indicators?.quote?.[0]) {
    throw new Error(`No data for ${symbol}`)
  }
  
  const quotes = result.indicators.quote[0]
  const timestamps = result.timestamp || []
  
  const candles: Candle[] = []
  for (let i = 0; i < timestamps.length; i++) {
    if (quotes.open[i] && quotes.close[i]) {
      candles.push({
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i] || 0,
        date: new Date(timestamps[i] * 1000).toISOString()
      })
    }
  }
  
  return candles
}

// Detect Order Blocks
function findOrderBlocks(candles: Candle[]): OrderBlock[] {
  const blocks: OrderBlock[] = []
  const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length
  
  for (let i = 2; i < candles.length - 1; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]
    const next = candles[i + 1]
    
    // Bullish OB: down candle followed by strong up move
    if (prev.close < prev.open && curr.close > curr.open) {
      const moveSize = (curr.close - prev.low) / prev.low
      if (moveSize > 0.01 && curr.volume > avgVolume * 0.8) {
        blocks.push({
          type: 'bullish',
          top: prev.open,
          bottom: prev.low,
          volume: prev.volume,
          date: prev.date,
          strength: Math.min(moveSize * 100, 100),
          tested: false
        })
      }
    }
    
    // Bearish OB: up candle followed by strong down move
    if (prev.close > prev.open && curr.close < curr.open) {
      const moveSize = (prev.high - curr.close) / prev.high
      if (moveSize > 0.01 && curr.volume > avgVolume * 0.8) {
        blocks.push({
          type: 'bearish',
          top: prev.high,
          bottom: prev.open,
          volume: prev.volume,
          date: prev.date,
          strength: Math.min(moveSize * 100, 100),
          tested: false
        })
      }
    }
  }
  
  // Keep only recent blocks (last 10)
  return blocks.slice(-10)
}

// Detect Break of Structure
function findBOS(candles: Candle[]): { price: number; type: string; date: string }[] {
  const bos: { price: number; type: string; date: string }[] = []
  
  let swingHigh = candles[0].high
  let swingLow = candles[0].low
  
  for (let i = 5; i < candles.length; i++) {
    const curr = candles[i]
    
    // Bullish BOS - break above swing high
    if (curr.close > swingHigh) {
      bos.push({ price: swingHigh, type: 'bullish', date: curr.date })
      swingHigh = curr.high
    }
    
    // Bearish BOS - break below swing low
    if (curr.close < swingLow) {
      bos.push({ price: swingLow, type: 'bearish', date: curr.date })
      swingLow = curr.low
    }
    
    // Update swing points
    if (curr.high > swingHigh) swingHigh = curr.high
    if (curr.low < swingLow) swingLow = curr.low
  }
  
  return bos.slice(-5)
}

// Detect Fair Value Gaps
function findFVG(candles: Candle[]): { top: number; bottom: number; type: string }[] {
  const fvg: { top: number; bottom: number; type: string }[] = []
  
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2]
    const c3 = candles[i]
    
    // Bullish FVG
    if (c3.low > c1.high) {
      fvg.push({ top: c3.low, bottom: c1.high, type: 'bullish' })
    }
    
    // Bearish FVG
    if (c3.high < c1.low) {
      fvg.push({ top: c1.low, bottom: c3.high, type: 'bearish' })
    }
  }
  
  return fvg.slice(-5)
}

// Generate alerts based on current price and SMC levels
function generateAlerts(
  price: number,
  orderBlocks: OrderBlock[],
  bos: { price: number; type: string }[]
): { type: string; message: string; price: number }[] {
  const alerts: { type: string; message: string; price: number }[] = []
  
  for (const ob of orderBlocks) {
    const inZone = price >= ob.bottom && price <= ob.top
    const nearZone = price >= ob.bottom * 0.98 && price <= ob.top * 1.02
    
    if (inZone) {
      if (ob.type === 'bullish') {
        alerts.push({
          type: 'entry',
          message: 'Price in Bullish OB - Discount Zone',
          price: ob.bottom
        })
      } else {
        alerts.push({
          type: 'entry', 
          message: 'Price in Bearish OB - Premium Zone',
          price: ob.top
        })
      }
    } else if (nearZone) {
      alerts.push({
        type: 'watch',
        message: `Approaching ${ob.type} Order Block`,
        price: ob.type === 'bullish' ? ob.bottom : ob.top
      })
    }
  }
  
  // BOS alerts
  const lastBOS = bos[bos.length - 1]
  if (lastBOS) {
    alerts.push({
      type: 'info',
      message: `${lastBOS.type === 'bullish' ? 'Bullish' : 'Bearish'} BOS confirmed`,
      price: lastBOS.price
    })
  }
  
  return alerts
}

// Main SMC analysis function
async function analyzeSMC(symbol: string, interval: string): Promise<SMCResult> {
  const candles = await fetchCandles(symbol, interval)
  
  if (candles.length < 20) {
    throw new Error('Not enough data')
  }
  
  const currentPrice = candles[candles.length - 1].close
  const orderBlocks = findOrderBlocks(candles)
  const bos = findBOS(candles)
  const fvg = findFVG(candles)
  const alerts = generateAlerts(currentPrice, orderBlocks, bos)
  
  // Determine trend
  const recentCandles = candles.slice(-20)
  const sma = recentCandles.reduce((sum, c) => sum + c.close, 0) / 20
  const trend = currentPrice > sma * 1.02 ? 'bullish' : currentPrice < sma * 0.98 ? 'bearish' : 'neutral'
  
  // Find support/resistance
  const bullishOBs = orderBlocks.filter(ob => ob.type === 'bullish')
  const bearishOBs = orderBlocks.filter(ob => ob.type === 'bearish')
  
  const support = bullishOBs.length > 0 
    ? Math.max(...bullishOBs.map(ob => ob.bottom).filter(p => p < currentPrice))
    : null
    
  const resistance = bearishOBs.length > 0
    ? Math.min(...bearishOBs.map(ob => ob.top).filter(p => p > currentPrice))
    : null
  
  // Price targets
  const priceTarget = trend === 'bullish' && resistance ? resistance : 
                      trend === 'bearish' && support ? support : null
  const stopLoss = trend === 'bullish' && support ? support * 0.98 :
                   trend === 'bearish' && resistance ? resistance * 1.02 : null
  
  return {
    symbol,
    current_price: currentPrice,
    trend,
    order_blocks: orderBlocks,
    bos_levels: bos,
    fvg_zones: fvg,
    alerts,
    support,
    resistance,
    price_target: priceTarget,
    stop_loss: stopLoss,
    generated_at: new Date().toISOString()
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.toUpperCase()
  const interval = searchParams.get('interval') || '1h'
  
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }
  
  try {
    const result = await analyzeSMC(symbol, interval)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    )
  }
}
