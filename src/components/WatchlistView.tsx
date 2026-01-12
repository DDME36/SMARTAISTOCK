'use client'

import { useState } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Search, SortAsc, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useLivePrices } from '@/hooks/useLivePrices'
import { formatPrice } from '@/lib/utils'
import ConfirmDialog from './ConfirmDialog'

type SortType = 'name' | 'price' | 'trend'

export default function WatchlistView() {
  const { watchlist, smcData, removeSymbol, showToast } = useStore()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortType>('name')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const { prices: livePrices, loading, refresh } = useLivePrices(watchlist)

  const handleRemove = (symbol: string) => {
    setDeleteConfirm(symbol)
  }

  const confirmRemove = () => {
    if (deleteConfirm) {
      removeSymbol(deleteConfirm)
      showToast(`${t('removed')} ${deleteConfirm}`)
      setDeleteConfirm(null)
    }
  }

  // Helper to get trend direction
  const getTrendDirection = (trend: string | { direction: string } | undefined): string => {
    if (!trend) return 'neutral'
    if (typeof trend === 'string') return trend
    return trend.direction || 'neutral'
  }

  // Get stock data (SMC or live) - ALWAYS prefer live price
  const getStockData = (symbol: string) => {
    const smcStock = smcData?.stocks?.[symbol]
    const livePrice = livePrices[symbol]

    // Get name from API response
    const name = livePrice?.name || symbol
    const exchange = livePrice?.exchange || 'US'
    
    // ALWAYS prefer live price over SMC cached price
    const price = livePrice?.price || smcStock?.current_price || null
    const change = livePrice?.change

    if (smcStock) {
      return {
        price,
        change,
        trend: getTrendDirection(smcStock.trend),
        hasAnalysis: true,
        buyZones: smcStock.ob_summary?.total_buy || 0,
        sellZones: smcStock.ob_summary?.total_sell || 0,
        alertCount: smcStock.alerts?.length || 0,
        name,
        exchange
      }
    }

    if (livePrice) {
      const dir = livePrice.change > 0.5 ? 'up' : livePrice.change < -0.5 ? 'down' : 'flat'
      return {
        price,
        change,
        trend: dir,
        hasAnalysis: false,
        buyZones: 0,
        sellZones: 0,
        alertCount: 0,
        name,
        exchange
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
      name,
      exchange
    }
  }

  // Filter and sort
  let filteredList = watchlist.filter(symbol =>
    symbol.toLowerCase().includes(search.toLowerCase()) ||
    (livePrices[symbol]?.name || '').toLowerCase().includes(search.toLowerCase())
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
        <button 
          onClick={refresh} 
          disabled={loading}
          className="refresh-btn"
          title="Refresh prices"
          style={{ marginLeft: 'auto' }}
        >
          <RefreshCw size={14} className={loading ? 'icon-spin' : ''} />
        </button>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={t('confirm_delete_symbol')}
        message={`${deleteConfirm} - ${t('confirm_delete_symbol_desc')}`}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setDeleteConfirm(null)}
      />
    </main>
  )
}
