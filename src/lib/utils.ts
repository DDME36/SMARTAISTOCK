import { Theme } from '@/types'

const MARKET_OPEN = { hour: 9, minute: 30 }
const MARKET_CLOSE = { hour: 16, minute: 0 }

export function isMarketOpen(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const mins = et.getHours() * 60 + et.getMinutes()
  const openMins = MARKET_OPEN.hour * 60 + MARKET_OPEN.minute
  const closeMins = MARKET_CLOSE.hour * 60 + MARKET_CLOSE.minute
  return day >= 1 && day <= 5 && mins >= openMins && mins < closeMins
}

export function getETTime(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatPrice(price: number | undefined): string {
  return price ? price.toFixed(2) : 'N/A'
}

export function getThemeByTime(): Theme {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function isDataStale(generatedAt: string | undefined): { stale: boolean; minutesAgo: number } {
  if (!generatedAt) return { stale: false, minutesAgo: 0 }
  const dataTime = new Date(generatedAt)
  const now = new Date()
  const diffMins = Math.round((now.getTime() - dataTime.getTime()) / (1000 * 60))
  return { stale: isMarketOpen() && diffMins > 60, minutesAgo: diffMins }
}

export async function validateSymbol(symbol: string): Promise<{ valid: boolean; name?: string; price?: number; error?: string }> {
  try {
    // Use our API route to avoid CORS issues
    const res = await fetch(`/api/validate-symbol?symbol=${encodeURIComponent(symbol)}`)
    const data = await res.json()
    return data
  } catch {
    // If API fails, allow the symbol (will be validated by backend)
    return { valid: true, name: symbol.toUpperCase() }
  }
}
