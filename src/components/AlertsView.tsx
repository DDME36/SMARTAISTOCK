'use client'

import { Bell, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'

type FilterType = 'all' | 'buy' | 'sell'

export default function AlertsView() {
  const { watchlist, smcData } = useStore()
  const { t, language } = useTranslation()
  const [filter, setFilter] = useState<FilterType>('all')

  // Function to translate alert messages
  const translateMessage = (message: string): string => {
    if (language === 'en') return message
    
    // Bullish BOS
    if (message.includes('Bullish BOS: Price broke above')) {
      const price = message.match(/[\d.]+$/)?.[0] || ''
      return `${t('alert_bullish_bos')} ${price}`
    }
    
    // Bearish BOS
    if (message.includes('Bearish BOS: Price broke below')) {
      const price = message.match(/[\d.]+$/)?.[0] || ''
      return `${t('alert_bearish_bos')} ${price}`
    }
    
    // Premium Zone
    if (message.includes('Premium Zone')) {
      return t('alert_premium_zone')
    }
    
    // Discount Zone
    if (message.includes('Discount Zone')) {
      return t('alert_discount_zone')
    }
    
    // FVG BUY
    if (message.includes('FVG BUY at')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `${t('alert_fvg_buy')} $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    // FVG SELL
    if (message.includes('FVG SELL at')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `${t('alert_fvg_sell')} $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    // BUY Zone / SELL Zone
    if (message.includes('BUY Zone')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `โซนซื้อ ที่ $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    if (message.includes('SELL Zone')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `โซนขาย ที่ $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    return message
  }

  // Collect all alerts from watchlist stocks
  const alerts: { symbol: string; message: string; signal: string; type: string; distancePct?: number }[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (stock?.alerts?.length) {
      for (const alert of stock.alerts) {
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.signal,
          type: alert.type,
          distancePct: alert.distance_pct
        })
      }
    }
  }

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'buy') return alert.signal === 'BUY'
    if (filter === 'sell') return alert.signal === 'SELL'
    return true
  })

  // Sort by distance (nearest first)
  filteredAlerts.sort((a, b) => (a.distancePct || 100) - (b.distancePct || 100))

  const buyCount = alerts.filter(a => a.signal === 'BUY').length
  const sellCount = alerts.filter(a => a.signal === 'SELL').length

  return (
    <main className="alerts-page">
      {/* Stats Header */}
      <div className="alerts-header">
        <div className="alerts-stat">
          <TrendingUp size={18} style={{ color: 'var(--accent-success)' }} />
          <span className="alerts-stat-value">{buyCount}</span>
          <span className="alerts-stat-label">{t('buy_signals')}</span>
        </div>
        <div className="alerts-stat">
          <TrendingDown size={18} style={{ color: 'var(--accent-danger)' }} />
          <span className="alerts-stat-value">{sellCount}</span>
          <span className="alerts-stat-label">{t('sell_signals')}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="alerts-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('all')} ({alerts.length})
        </button>
        <button 
          className={`filter-btn buy ${filter === 'buy' ? 'active' : ''}`}
          onClick={() => setFilter('buy')}
        >
          {t('buy')} ({buyCount})
        </button>
        <button 
          className={`filter-btn sell ${filter === 'sell' ? 'active' : ''}`}
          onClick={() => setFilter('sell')}
        >
          {t('sell')} ({sellCount})
        </button>
      </div>

      {/* Alerts List */}
      <div className="card">
        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bell size={28} />
            </div>
            <h3>{t('no_alerts_yet')}</h3>
            <p>{t('add_stocks_alerts')}</p>
          </div>
        ) : (
          <div className="alerts-list">
            {filteredAlerts.map((alert, i) => (
              <div 
                key={i} 
                className={`alert-item ${alert.signal.toLowerCase()}`}
              >
                <div className="alert-icon">
                  {alert.signal === 'BUY' ? (
                    <TrendingUp size={18} />
                  ) : (
                    <TrendingDown size={18} />
                  )}
                </div>
                <div className="alert-content">
                  <div className="alert-header">
                    <span className="alert-symbol">{alert.symbol}</span>
                    {alert.distancePct !== undefined && (
                      <span className={`alert-distance ${alert.distancePct <= 2 ? 'near' : ''}`}>
                        {alert.distancePct}% {t('away')}
                      </span>
                    )}
                  </div>
                  <p className="alert-message">{translateMessage(alert.message)}</p>
                </div>
                <span className={`badge ${alert.signal === 'BUY' ? 'badge-bull' : 'badge-bear'}`}>
                  {alert.signal === 'BUY' ? t('buy').toUpperCase() : t('sell').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
