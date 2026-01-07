'use client'

import { useState, useEffect, useRef } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Search, SortAsc } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { formatPrice } from '@/lib/utils'

type SortType = 'name' | 'price' | 'trend'

interface LivePrice {
  price: number
  change: number
}

// Stock name mapping
const stockNames: Record<string, { name: string; exchange: string }> = {
  'AAPL': { name: 'Apple Inc.', exchange: 'NASDAQ' },
  'TSLA': { name: 'Tesla Inc.', exchange: 'NASDAQ' },
  'NVDA': { name: 'NVIDIA Corp.', exchange: 'NASDAQ' },
  'GOOGL': { name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  'MSFT': { name: 'Microsoft Corp.', exchange: 'NASDAQ' },
  'AMZN': { name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
  'META': { name: 'Meta Platforms', exchange: 'NASDAQ' },
  'AMD': { name: 'AMD Inc.', exchange: 'NASDAQ' },
  'NFLX': { name: 'Netflix Inc.', exchange: 'NASDAQ' },
  'RKLB': { name: 'Rocket Lab USA', exchange: 'NASDAQ' },
  'EOSE': { name: 'Eos Energy', exchange: 'NASDAQ' },
  'PLTR': { name: 'Palantir Tech', exchange: 'NYSE' },
  'COIN': { name: 'Coinbase Global', exchange: 'NASDAQ' },
  'SOFI': { name: 'SoFi Technologies', exchange: 'NASDAQ' },
  'NIO': { name: 'NIO Inc.', exchange: 'NYSE' },
  'RIVN': { name: 'Rivian Automotive', exchange: 'NASDAQ' },
  'LCID': { name: 'Lucid Group', exchange: 'NASDAQ' },
  'BTC-USD': { name: 'Bitcoin', exchange: 'Crypto' },
  'ETH-USD': { name: 'Ethereum', exchange: 'Crypto' },
  'SOL-USD': { name: 'Solana', exchange: 'Crypto' },
  'XRP-USD': { name: 'Ripple', exchange: 'Crypto' },
  'DOGE-USD': { name: 'Dogecoin', exchange: 'Crypto' },
}

export default function WatchlistView() {
  const { watchlist, smcData, removeSymbol, showToast } = useStore()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortType>('name')
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({})
  const [loading, setLoading] = useState(false)
  const hasFetchedRef = useRef(false)

  // Fetch live prices for stocks without SMC data
  // Fetch live prices for stocks without SMC data
  useEffect(() => {
    if (watchlist.length === 0) return

    const needPrices = watchlist.filter(s => !smcData?.stocks?.[s]?.current_price)
    if (needPrices.length === 0) return

    // Check if we have symbols that absolutely need data right now (not just update)
    const missingData = needPrices.some(s => !livePrices[s])

    // If we have fetched recently AND we aren't missing any data, skip
    if (hasFetchedRef.current && !missingData) return

    const fetchPrices = async () => {
      setLoading(true)
      hasFetchedRef.current = true

      try {
        const res = await fetch('/api/stock-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: needPrices })
        })
        const data = await res.json()
        if (data.prices) {
          setLivePrices(prev => ({ ...prev, ...data.prices }))
        }
      } catch (e) {
        console.error('Price fetch error:', e)
      } finally {
        setLoading(false)
        // Reset ref after 60s to allow update
        setTimeout(() => { hasFetchedRef.current = false }, 60000)
      }
    }

    fetchPrices()

    // Set up auto-refresh every 60s
    const intervalId = setInterval(() => {
      hasFetchedRef.current = false
      fetchPrices()
    }, 60000)

    return () => clearInterval(intervalId)
  }, [watchlist, smcData])

  const handleRemove = (symbol: string) => {
    if (confirm(`${t('removed')} ${symbol}?`)) {
      removeSymbol(symbol)
      showToast(`${t('removed')} ${symbol}`)
    }
  }

  // Helper to get trend direction
  const getTrendDirection = (trend: string | { direction: string } | undefined): string => {
    if (!trend) return 'neutral'
    if (typeof trend === 'string') return trend
    return trend.direction || 'neutral'
  }

  // Get stock data (SMC or live)
  const getStockData = (symbol: string) => {
    const smcStock = smcData?.stocks?.[symbol]
    const livePrice = livePrices[symbol]
    const stockInfo = stockNames[symbol]

    if (smcStock?.current_price) {
      return {
        price: smcStock.current_price,
        change: undefined,
        trend: getTrendDirection(smcStock.trend),
        hasAnalysis: true,
        buyZones: smcStock.ob_summary?.total_buy || 0,
        sellZones: smcStock.ob_summary?.total_sell || 0,
        alertCount: smcStock.alerts?.length || 0,
        name: stockInfo?.name || symbol,
        exchange: stockInfo?.exchange || 'US'
      }
    }

    if (livePrice) {
      const dir = livePrice.change > 0.5 ? 'up' : livePrice.change < -0.5 ? 'down' : 'flat'
      return {
        price: livePrice.price,
        change: livePrice.change,
        trend: dir,
        hasAnalysis: false,
        buyZones: 0,
        sellZones: 0,
        alertCount: 0,
        name: stockInfo?.name || symbol,
        exchange: stockInfo?.exchange || 'US'
      }
    }

    return {
      price: null,
      change: undefined,
      trend: 'neutral',
      hasAnalysis: false,
      buyZones: 0,
      sellZones: 0,
      alertCount: 0,
      name: stockInfo?.name || symbol,
      exchange: stockInfo?.exchange || 'US'
    }
  }

  // Filter and sort
  let filteredList = watchlist.filter(symbol =>
    symbol.toLowerCase().includes(search.toLowerCase())
  )

  // Sort
  filteredList = [...filteredList].sort((a, b) => {
    if (sortBy === 'name') return a.localeCompare(b)
    if (sortBy === 'price') {
      const priceA = getStockData(a).price || 0
      const priceB = getStockData(b).price || 0
      return priceB - priceA
    }
    if (sortBy === 'trend') {
      const trendOrder: Record<string, number> = { bullish: 0, up: 0, neutral: 1, flat: 1, bearish: 2, down: 2 }
      const trendA = getStockData(a).trend
      const trendB = getStockData(b).trend
      return (trendOrder[trendA] || 1) - (trendOrder[trendB] || 1)
    }
    return 0
  })

  const getTrendIcon = (trend: string) => {
    if (trend === 'bullish' || trend === 'up') return <TrendingUp size={14} style={{ color: 'var(--accent-success)' }} />
    if (trend === 'bearish' || trend === 'down') return <TrendingDown size={14} style={{ color: 'var(--accent-danger)' }} />
    return <Minus size={14} style={{ color: 'var(--text-tertiary)' }} />
  }

  return (
    <main className="watchlist-page">
      {/* Search & Sort */}
      <div className="watchlist-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder={t('search_symbols')}
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
          />
        </div>
        <div className="sort-buttons">
          <button
            className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => setSortBy('name')}
            title="Sort by name"
          >
            A-Z
          </button>
          <button
            className={`sort-btn ${sortBy === 'price' ? 'active' : ''}`}
            onClick={() => setSortBy('price')}
            title="Sort by price"
          >
            $
          </button>
          <button
            className={`sort-btn ${sortBy === 'trend' ? 'active' : ''}`}
            onClick={() => setSortBy('trend')}
            title="Sort by trend"
          >
            <SortAsc size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="watchlist-stats">
        <span>{filteredList.length} {t('of')} {watchlist.length} {t('stocks')}</span>
        {loading && <span className="loading-dot" style={{ marginLeft: 8 }} />}
      </div>

      {/* List */}
      <div className="card">
        {filteredList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={28} />
            </div>
            <h3>{watchlist.length === 0 ? t('no_watchlist') : t('no_signals')}</h3>
            <p>{t('add_stocks_dashboard')}</p>
          </div>
        ) : (
          <div className="watchlist-items">
            {filteredList.map(symbol => {
              const { price, change, trend, hasAnalysis, buyZones, sellZones, alertCount, name, exchange } = getStockData(symbol)
              const logoUrl = `https://assets.parqet.com/logos/symbol/${symbol}?format=png`

              return (
                <div key={symbol} className="wl-view-item">
                  {/* Left: Logo + Info */}
                  <div className="wl-view-left">
                    <div className="wl-view-logo-wrap">
                      <img
                        src={logoUrl}
                        alt={symbol}
                        className="wl-view-logo"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      <div className="wl-view-logo-fallback">
                        {symbol.substring(0, 2)}
                      </div>
                    </div>

                    <div className="wl-view-info">
                      <div className="wl-view-top">
                        <span className="wl-view-symbol">{symbol}</span>
                        {getTrendIcon(trend)}
                      </div>
                      <div className="wl-view-name">{name}</div>
                      <div className="wl-view-meta">
                        <span className="wl-view-exchange">{exchange}</span>
                        {hasAnalysis && (
                          <>
                            <span className="wl-view-zone buy">{buyZones} {t('buy').toLowerCase()}</span>
                            <span className="wl-view-zone sell">{sellZones} {t('sell').toLowerCase()}</span>
                            {alertCount > 0 && (
                              <span className="wl-view-alert">{alertCount} {t('alerts').toLowerCase()}</span>
                            )}
                          </>
                        )}
                        {!hasAnalysis && <span className="wl-view-badge">LIVE</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Price + Change */}
                  <div className="wl-view-right">
                    <div className="wl-view-price-block">
                      <span className="wl-view-price">
                        ${price ? formatPrice(price) : '...'}
                      </span>
                      {change !== undefined && (
                        <span className={`wl-view-change ${trend}`}>
                          {trend === 'up' && <TrendingUp size={12} />}
                          {trend === 'down' && <TrendingDown size={12} />}
                          {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      )}
                      {change === undefined && hasAnalysis && (
                        <span className={`wl-view-trend-badge ${trend}`}>
                          {trend === 'bullish' ? t('bullish') : trend === 'bearish' ? t('bearish') : t('neutral_trend')}
                        </span>
                      )}
                    </div>
                    <button
                      className="wl-view-remove"
                      onClick={() => handleRemove(symbol)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
