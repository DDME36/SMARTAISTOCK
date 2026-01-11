// SMC Data Types
export interface OrderBlock {
  type: 'bullish' | 'bearish'
  signal: 'BUY' | 'SELL'
  color: string
  high: number
  low: number
  mid: number
  distance: number
  distance_pct: number
  rank: number
  // Quality indicators (v2.0)
  quality_score?: number
  strength?: 'weak' | 'medium' | 'strong'
  in_zone?: boolean
  trend_aligned?: boolean
  volume?: {
    ratio: number
    confirmed: boolean
  }
  date?: string
}

export interface Alert {
  type: string
  signal: 'BUY' | 'SELL'
  message: string
  high?: number
  low?: number
  distance_pct?: number
  priority?: 'critical' | 'high' | 'medium' | 'low'
  level?: number
  ob_type?: string
  ob_high?: number
  ob_low?: number
}

export interface StockData {
  symbol: string
  current_price: number
  interval: string
  data_source: string
  last_updated: string
  candles_analyzed?: number
  // Trend can be string (old format) or object (new format)
  trend: 'bullish' | 'bearish' | 'neutral' | {
    direction: 'bullish' | 'bearish' | 'neutral'
    strength: number
    structure: string
    hh_count?: number
    hl_count?: number
    lh_count?: number
    ll_count?: number
  }
  // Order Blocks
  order_blocks?: OrderBlock[]
  major_order_blocks?: OrderBlock[]
  swing_order_blocks?: OrderBlock[]
  internal_order_blocks?: OrderBlock[]
  nearest_buy_zone: OrderBlock | null
  nearest_sell_zone: OrderBlock | null
  // Fair Value Gaps
  fair_value_gaps?: Array<{
    type: 'bullish' | 'bearish'
    signal: 'BUY' | 'SELL'
    high: number
    low: number
    mid: number
    gap_pct: number
    distance_pct: number
    filled: boolean
  }>
  // Structure Breaks
  structure_breaks?: {
    bos: Array<{ type: string; level: number; signal: string; message: string }>
    choch: { type: string; level: number; signal: string; message: string } | null
  }
  // Liquidity Zones
  liquidity_zones?: {
    equal_highs: Array<{ level: number; type: string; signal: string; distance_pct: number }>
    equal_lows: Array<{ level: number; type: string; signal: string; distance_pct: number }>
  }
  // Summary
  ob_summary: {
    total_buy: number
    total_sell: number
    total_fvg?: number
  }
  zones: {
    premium: { high: number; low: number; signal: string }
    discount: { high: number; low: number; signal: string }
    equilibrium: number
    current_zone?: string
    zone_signal?: string
    fibonacci?: Record<string, number>
  } | null
  // Indicators
  indicators?: {
    rsi?: { value: number; signal: string }
    atr?: { value: number; pct: number }
    ma20?: number
    ma50?: number
  }
  alerts: Alert[]
  alert_count?: number
}

export interface MarketSentiment {
  score: number
  recommendation: string
  message: string
  indicators: {
    fear_greed: { 
      score: number
      rating: string
      signal: string
      source: string
      stock?: { score: number; rating: string; components?: Record<string, number> }
      crypto?: { score: number; rating: string }
    }
    vix: { 
      value: number
      change: number
      change_pct?: number
      signal: string
      level?: string
      trend: string
      interpretation?: string
    }
    market_breadth: { 
      bullish: number
      bearish: number
      neutral: number
      signal: string
      score?: number
      indices?: Record<string, { name: string; change_pct: number; status: string }>
    }
    sectors?: {
      sectors: Array<{ symbol: string; name: string; change_1d: number; change_5d: number }>
      rotation: string
      signal: string
    }
    moving_averages: { 
      trend: string
      ma50_above_ma200: boolean
      price?: number
      ma20?: number
      ma50?: number
      ma200?: number
      bullish_signals?: number
      cross?: string | null
    }
    treasury_yields?: {
      yields: Record<string, number>
      inverted: boolean
      signal: string
    }
  }
  score_breakdown?: Record<string, number>
  updated_at: string
}

export interface SMCData {
  generated_at: string
  interval?: string
  stocks: Record<string, StockData>
  market_sentiment: MarketSentiment
  summary?: {
    total_stocks: number
    total_alerts: number
    market_bias: { bullish: number; bearish: number; neutral: number }
    sentiment_score: number
    recommendation: string
    top_buy_opportunities?: Array<{ symbol: string; message: string; distance_pct: number }>
    top_sell_opportunities?: Array<{ symbol: string; message: string; distance_pct: number }>
  }
}

export interface Watchlist {
  symbols: string[]
  interval: string
  updated_at: string
}

export type Theme = 'morning' | 'afternoon' | 'evening' | 'night'
export type Language = 'en' | 'th'
