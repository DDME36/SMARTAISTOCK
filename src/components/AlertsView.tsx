'use client'

import { Bell, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'

type FilterType = 'all' | 'buy' | 'sell'

interface AlertItem {
  symbol: string
  message: string
  signal: string
  type: string
  distancePct?: number
  level?: number
  ob_high?: number
  ob_low?: number
}

export default function AlertsView() {
  const { watchlist, smcData } = useStore()
  const { t, language } = useTranslation()
  const [filter, setFilter] = useState<FilterType>('all')

  // Function to translate alert messages based on language
  const translateMessage = (alert: AlertItem): string => {
    const message = alert.message
    const type = alert.type || ''
    
    if (language === 'th') {
      // Already Thai - return as is
      if (message.includes('ราคาเข้าโซน') || message.includes('ใกล้โซน') || message.includes('สัญญาณ')) {
        return message
      }
      
      // Translate English to Thai
      if (type.startsWith('ob_entry_')) {
        const signal = alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'
        return `🎯 ราคาเข้าโซน ${alert.signal} Order Block! - สัญญาณ${signal}`
      }
      if (type.startsWith('ob_near_')) {
        return `⚠️ ใกล้โซน ${alert.signal} ที่ $${alert.level?.toFixed(2) || ''} (${alert.distancePct?.toFixed(1) || ''}% away)`
      }
      if (type.includes('choch')) {
        if (type.includes('bullish')) return 'Bullish CHoCH: อาจกลับตัวเป็นขาขึ้น'
        return 'Bearish CHoCH: อาจกลับตัวเป็นขาลง'
      }
      if (type.includes('bos')) {
        if (type.includes('bullish')) return `Bullish BOS: ราคาทะลุขึ้น`
        return `Bearish BOS: ราคาทะลุลง`
      }
      if (type.includes('fvg')) {
        const signal = alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'
        return `FVG ${signal} ที่ $${alert.level?.toFixed(2) || ''}`
      }
      if (type === 'zone_premium') return 'ราคาอยู่ในโซน Premium - มองหาจุดขาย'
      if (type === 'zone_discount') return 'ราคาอยู่ในโซน Discount - มองหาจุดซื้อ'
      if (type === 'bullish' || type === 'bearish') {
        const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
        if (match) {
          const signal = alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'
          return `โซน${signal} ที่ $${match[1]} (ห่าง ${match[2]}%)`
        }
      }
      
      return message
    }
    
    // English translation
    if (language === 'en') {
      // OB Entry alerts (Thai -> English)
      if (message.includes('ราคาเข้าโซน') && message.includes('Order Block')) {
        const signal = alert.signal === 'BUY' ? 'Buy' : 'Sell'
        return `🎯 Price entered ${alert.signal} Order Block! - ${signal} signal`
      }
      
      // Near OB alerts (Thai -> English)
      if (message.includes('ใกล้โซน')) {
        return `⚠️ Near ${alert.signal} Zone at $${alert.level?.toFixed(2) || ''} (${alert.distancePct?.toFixed(1) || ''}% away)`
      }
      
      // Already English - return as is
      if (message.includes('CHoCH') || message.includes('BOS') || message.includes('FVG')) {
        return message
      }
      if (message.includes('Zone') && !message.includes('โซน')) {
        return message
      }
      
      // Type-based translation
      if (type.startsWith('ob_entry_')) {
        const signal = alert.signal === 'BUY' ? 'Buy' : 'Sell'
        return `🎯 Price entered ${alert.signal} Order Block! - ${signal} signal`
      }
      if (type.startsWith('ob_near_')) {
        return `⚠️ Near ${alert.signal} Zone at $${alert.level?.toFixed(2) || ''} (${alert.distancePct?.toFixed(1) || ''}% away)`
      }
      if (type.includes('choch')) {
        if (type.includes('bullish')) return 'Bullish CHoCH: Potential trend reversal to upside'
        return 'Bearish CHoCH: Potential trend reversal to downside'
      }
      if (type.includes('bos')) {
        if (type.includes('bullish')) return `Bullish BOS: Price broke above resistance`
        return `Bearish BOS: Price broke below support`
      }
      if (type.includes('fvg')) {
        return `FVG ${alert.signal} at $${alert.level?.toFixed(2) || ''}`
      }
      if (type === 'zone_premium') return 'Price in Premium Zone - Look for sells'
      if (type === 'zone_discount') return 'Price in Discount Zone - Look for buys'
      if (type === 'bullish' || type === 'bearish') {
        const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
        if (match) {
          return `${alert.signal} Zone at $${match[1]} (${match[2]}% away)`
        }
      }
      
      // Generic Thai to English
      if (message.includes('สัญญาณซื้อ')) return message.replace('สัญญาณซื้อ', 'Buy signal')
      if (message.includes('สัญญาณขาย')) return message.replace('สัญญาณขาย', 'Sell signal')
      if (message.includes('โซนซื้อ')) return message.replace('โซนซื้อ', 'Buy Zone')
      if (message.includes('โซนขาย')) return message.replace('โซนขาย', 'Sell Zone')
      
      return message
    }
    
    return message
  }

  // Collect all alerts from watchlist stocks
  const alerts: AlertItem[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (stock?.alerts?.length) {
      for (const alert of stock.alerts) {
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.signal,
          type: alert.type,
          distancePct: alert.distance_pct,
          level: alert.level,
          ob_high: alert.ob_high,
          ob_low: alert.ob_low
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
                  <p className="alert-message">{translateMessage(alert)}</p>
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
