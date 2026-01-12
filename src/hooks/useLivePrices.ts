'use client'

import { useState, useEffect, useCallback } from 'react'

interface LivePrice {
  price: number
  change: number
  changeAmount?: number
  previousClose?: number
  name?: string
  exchange?: string
}

// Global cache to share between components
let globalPrices: Record<string, LivePrice> = {}
let lastFetchTime = 0
const CACHE_TTL = 15000 // 15 seconds

export function useLivePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>(globalPrices)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPrices = useCallback(async (force = false) => {
    if (symbols.length === 0) return
    
    // Use cache if fresh enough and not forced
    const now = Date.now()
    if (!force && now - lastFetchTime < CACHE_TTL && Object.keys(globalPrices).length > 0) {
      setPrices(globalPrices)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      })
      
      if (!res.ok) throw new Error('Failed to fetch prices')
      
      const data = await res.json()
      if (data.prices) {
        globalPrices = { ...globalPrices, ...data.prices }
        lastFetchTime = Date.now()
        setPrices(globalPrices)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [symbols])

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (symbols.length === 0) return
    
    fetchPrices()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchPrices(true), 30000)
    return () => clearInterval(interval)
  }, [symbols.join(','), fetchPrices])

  return { prices, loading, error, refresh: () => fetchPrices(true) }
}

// Helper to get price for a single symbol
export function getPrice(symbol: string): number | null {
  return globalPrices[symbol]?.price || null
}

// Clear cache (useful for testing)
export function clearPriceCache() {
  globalPrices = {}
  lastFetchTime = 0
}
