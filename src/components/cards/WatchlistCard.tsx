'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useLivePrices } from '@/hooks/useLivePrices'
import { formatPrice } from '@/lib/utils'

export default function WatchlistCard() {
  const { watchlist, smcData, removeSymbol, showToast } = useStore()
  const { t } = useTranslation()
  const { prices: livePrices, loading, refresh } = useLivePrices(watchlist)
  const [failedSymbols, setFailedSymbols] = useState<Set<string>>(new Set())

  // Check for failed symbols
  useEffect(() => {
    if (watchlist.length === 0) return
    const failed = new Set<string>()
    for (const sym of watchlist) {
      if (!livePrices[sym]) failed.add(sym)
    }
    setFailedSymbols(failed)
  }, [watchlist, livePrices])

  const getData = (symbol: string) => {
    const smc = smcData?.stocks?.[symbol]
    const live = livePrices[symbol]
    const failed = failedSymbols.has(symbol)
    
    // Get name from live data (API) or fallback to symbol
    const name = live?.name || symbol
    const exchange = live?.exchange || 'US'
    
    // ALWAYS prefer live price over SMC cached price
    const price = live?.price || smc?.current_price || null
    const change = live?.change
    
    if (smc) {
      // Use change value to determine color, not SMC trend
      const dir = change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : 
                  (typeof smc.trend === 'string' ? smc.trend : smc.trend?.direction || 'neutral')
      return { price, change, trend: dir, hasSmc: true, failed: false, name, exchange }
    }
    if (live) {
      // Any positive = green, any negative = red
      const dir = live.change > 0 ? 'up' : live.change < 0 ? 'down' : 'flat'
      return { price, change, trend: dir, hasSmc: false, failed: false, name, exchange }
    }
    return { price: null, change: undefined, trend: 'neutral', hasSmc: false, failed, name, exchange }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={refresh} 
            disabled={loading}
            className="refresh-btn"
            title="Refresh prices"
          >
            <RefreshCw size={14} className={loading ? 'icon-spin' : ''} />
          </button>
          <span className="watchlist-count">
            {watchlist.length} {t('assets')}
          </span>
        </div>
      </div>
      
      <div className="watchlist-list">
        {watchlist.length === 0 ? (
          <div className="watchlist-empty">{t('empty_watchlist')}</div>
        ) : watchlist.map(symbol => {
          const { price, change, trend, hasSmc, failed, name, exchange } = getData(symbol)
          const logo = 'https://assets.parqet.com/logos/symbol/' + symbol + '?format=png'
          const isLoading = loading && !price && !failed
          
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
