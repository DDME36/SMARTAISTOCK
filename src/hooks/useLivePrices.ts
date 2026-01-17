'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PRICE_CACHE_TTL, PRICE_REFRESH_INTERVAL, MAX_RETRY_COUNT, RETRY_BASE_DELAY } from '@/lib/constants'

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
  const [retryCount, setRetryCount] = useState(0)
  const mountedRef = useRef(true)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function for single fetch attempt
  const attemptFetch = async (symbols: string[], signal: AbortSignal) => {
    const res = await fetch('/api/stock-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
      signal
    })

    if (!res.ok) {
      throw new Error(res.status === 404 ? 'symbol_not_found' : 'error_fetch_prices')
    }

    return res.json()
  }

  const fetchPrices = useCallback(async (force = false, retry = 0) => {
    if (symbols.length === 0) return

    // Use cache if fresh enough and not forced
    const now = Date.now()
    if (!force && now - lastFetchTime < PRICE_CACHE_TTL && Object.keys(globalPrices).length > 0) {
      setPrices(globalPrices)
      return
    }

    setLoading(true)
    if (retry === 0) setError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const data = await attemptFetch(symbols, controller.signal)
      clearTimeout(timeoutId)

      if (data.prices && mountedRef.current) {
        globalPrices = { ...globalPrices, ...data.prices }
        lastFetchTime = Date.now()
        setPrices(globalPrices)
        setRetryCount(0)
      }
    } catch (e) {
      clearTimeout(timeoutId)

      if (!mountedRef.current) return

      // Retry with exponential backoff
      if (retry < MAX_RETRY_COUNT) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, retry)
        setRetryCount(retry + 1)
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchPrices(true, retry + 1)
          }
        }, delay)
        return
      }

      // All retries exhausted
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          setError('error_timeout')
        } else {
          setError(e.message || 'error_unknown')
        }
      } else {
        setError('error_unknown')
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
