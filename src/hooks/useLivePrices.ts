'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PRICE_CACHE_TTL, PRICE_REFRESH_INTERVAL } from '@/lib/constants'

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

export function useLivePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>(globalPrices)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchPrices = useCallback(async (force = false) => {
    if (symbols.length === 0) return
    
    // Use cache if fresh enough and not forced
    const now = Date.now()
    if (!force && now - lastFetchTime < PRICE_CACHE_TTL && Object.keys(globalPrices).length > 0) {
      setPrices(globalPrices)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const res = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'symbol_not_found' : 'error_fetch_prices')
      }
      
      const data = await res.json()
      
      if (data.prices && mountedRef.current) {
        globalPrices = { ...globalPrices, ...data.prices }
        lastFetchTime = Date.now()
        setPrices(globalPrices)
      }
    } catch (e) {
      if (mountedRef.current) {
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            setError('error_timeout')
          } else {
            setError(e.message || 'error_unknown')
          }
        } else {
          setError('error_unknown')
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [symbols])

  // Initial fetch and auto-refresh
  useEffect(() => {
    mountedRef.current = true
    
    if (symbols.length === 0) return
    
    fetchPrices()
    
    // Auto-refresh
    const interval = setInterval(() => fetchPrices(true), PRICE_REFRESH_INTERVAL)
    
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [symbols.join(','), fetchPrices])

  return { 
    prices, 
    loading, 
    error, 
    refresh: () => fetchPrices(true),
    clearError: () => setError(null)
  }
}

// Helper to get price for a single symbol
export function getPrice(symbol: string): number | null {
  return globalPrices[symbol]?.price || null
}

// Clear cache (useful for logout)
export function clearPriceCache() {
  globalPrices = {}
  lastFetchTime = 0
}
