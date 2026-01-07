'use client'

import { useState, useEffect, useRef } from 'react'
import { X, TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { formatPrice } from '@/lib/utils'

interface LivePrice {
  price: number
  change: number
}

const stockNames: Record<string, { name: string; exchange: string }> = {
  'AAPL': { name: 'Apple Inc.', exchange: 'NASDAQ' },
  'TSLA': { name: 'Tesla Inc.', exchange: 'NASDAQ' },
  'NVDA': { name: 'NVIDIA Corp.', exchange: 'NASDAQ' },
  'GOOGL': { name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  'MSFT': { name: 'Microsoft Corp.', exchange: 'NASDAQ' },
  'RKLB': { name: 'Rocket Lab USA', exchange: 'NASDAQ' },
  'EOSE': { name: 'Eos Energy', exchange: 'NASDAQ' },
  'PLTR': { name: 'Palantir Tech', exchange: 'NYSE' },
  'ACHR': { name: 'Archer Aviation', exchange: 'NYSE' },
  'RBLX': { name: 'Roblox Corp.', exchange: 'NYSE' },
  'PRME': { name: 'Prime Medicine', exchange: 'NASDAQ' },
  'BTC-USD': { name: 'Bitcoin', exchange: 'Crypto' },
  'ETH-USD': { name: 'Ethereum', exchange: 'Crypto' },
}

export default function WatchlistCard() {
  const { watchlist, smcData, removeSymbol, showToast } = useStore()
  const { t } = useTranslation()
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({})
  const [loading, setLoading] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [failedSymbols, setFailedSymbols] = useState<Set<string>>(new Set())
  const fetchedRef = useRef(false)

  const fetchPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      })
      const data = await res.json()
      if (data.prices) {
        setLivePrices(prev => ({ ...prev, ...data.prices }))
        const failed = new Set<string>()
        for (const sym of symbols) {
          if (!data.prices[sym]) failed.add(sym)
        }
        setFailedSymbols(failed)
        
        // If some failed, retry after 10 seconds
        if (failed.size > 0) {
          setRetryCountdown(10)
        }
      }
    } catch (e) { 
      console.error(e)
      setFailedSymbols(new Set(symbols))
      setRetryCountdown(10)
    } finally { 
      setLoading(false)
    }
  }

  useEffect(() => {
    if (fetchedRef.current || watchlist.length === 0) return
    const need = watchlist.filter(s => !smcData?.stocks?.[s]?.current_price && !livePrices[s])
    if (need.length === 0) return
    
    fetchedRef.current = true
    setTimeout(() => fetchPrices(need), 300)
    
    // Reset after 60 seconds to allow refetch
    setTimeout(() => { fetchedRef.current = false }, 60000)
  }, [watchlist, smcData, livePrices])

  // Retry countdown
  useEffect(() => {
    if (retryCountdown <= 0) return
    const timer = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          // Retry failed symbols
          const failed = Array.from(failedSymbols)
          if (failed.length > 0) {
            fetchPrices(failed)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [retryCountdown, failedSymbols])

  const getData = (symbol: string) => {
    const smc = smcData?.stocks?.[symbol]
    const live = livePrices[symbol]
    const info = stockNames[symbol] || { name: symbol, exchange: 'US' }
    const failed = failedSymbols.has(symbol)
    
    if (smc?.current_price) {
      const dir = typeof smc.trend === 'string' ? smc.trend : smc.trend?.direction || 'neutral'
      return { price: smc.current_price, change: undefined, trend: dir, hasSmc: true, failed: false, ...info }
    }
    if (live) {
      const dir = live.change > 0.5 ? 'up' : live.change < -0.5 ? 'down' : 'flat'
      return { price: live.price, change: live.change, trend: dir, hasSmc: false, failed: false, ...info }
    }
    return { price: null, change: undefined, trend: 'neutral', hasSmc: false, failed, ...info }
  }

  const getTrendText = (trend: string) => {
    if (trend === 'bullish' || trend === 'up') return t('bullish')
    if (trend === 'bearish' || trend === 'down') return t('bearish')
    return t('neutral_trend')
  }

  return (
    <article className="card col-span-2 watchlist-card">
      <div className="card-title">
        <span>{t('active_watchlist')}</span>
        <span className="watchlist-count">
          {loading && <Loader2 size={12} className="icon-spin" style={{ marginRight: 4 }} />}
          {watchlist.length} {t('assets')}
        </span>
      </div>
      
      <div className="watchlist-list">
        {watchlist.length === 0 ? (
          <div className="watchlist-empty">{t('empty_watchlist')}</div>
        ) : watchlist.map(symbol => {
          const { price, change, trend, hasSmc, failed, name, exchange } = getData(symbol)
          const logo = 'https://assets.parqet.com/logos/symbol/' + symbol + '?format=png'
          const isLoading = loading && !price && !failed
          const isRetrying = failed && retryCountdown > 0
          
          return (
            <div key={symbol} className="watchlist-row-v2">
              <div className="wl-left">
                <img src={logo} alt="" className="wl-logo" 
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <div className="wl-info">
                  <div className="wl-symbol-row">
                    <span className="wl-symbol">{symbol}</span>
                    <span className={'wl-badge ' + (hasSmc ? 'smc' : 'live')}>
                      {hasSmc ? 'SMC' : 'LIVE'}
                    </span>
                  </div>
                  <div className="wl-meta">
                    <span className="wl-name">{name}</span>
                    <span className="wl-exchange">{exchange}</span>
                  </div>
                </div>
              </div>
              <div className="wl-right">
                <div className="wl-price-block">
                  {isLoading ? (
                    <>
                      <span className="wl-price wl-price-loading">
                        <span className="skeleton-price"></span>
                      </span>
                      <span className="wl-change wl-loading-text">
                        <Loader2 size={10} className="icon-spin" /> {t('loading_prices')}
                      </span>
                    </>
                  ) : isRetrying ? (
                    <>
                      <span className="wl-price" style={{ opacity: 0.4 }}>
                        <RefreshCw size={14} className="icon-spin" />
                      </span>
                      <span className="wl-change wl-retry-text">
                        {t('retry_in')} {retryCountdown}{t('seconds')}
                      </span>
                    </>
                  ) : price ? (
                    <>
                      <span className="wl-price">{'$' + formatPrice(price)}</span>
                      <span className={'wl-change ' + trend}>
                        {change !== undefined ? (
                          <>
                            {trend === 'up' && <TrendingUp size={12} />}
                            {trend === 'down' && <TrendingDown size={12} />}
                            {(change > 0 ? '+' : '') + change.toFixed(2) + '%'}
                          </>
                        ) : getTrendText(trend)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="wl-price" style={{ opacity: 0.4 }}>---</span>
                      <span className="wl-change wl-unavailable">
                        {t('price_unavailable')}
                      </span>
                    </>
                  )}
                </div>
                <button className="wl-remove" onClick={() => { removeSymbol(symbol); showToast(t('removed') + ' ' + symbol) }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
