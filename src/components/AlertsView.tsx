'use client'

import { Bell, TrendingUp, TrendingDown, Zap, BarChart3, TrendingUp as TrendIcon } from 'lucide-react'
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
  // Quality indicators
  qualityScore?: number
  volumeConfirmed?: boolean
  trendAligned?: boolean
  strength?: string
}

// Get quality label and color
const getQualityInfo = (score: number, language: string) => {
  if (score >= 80) return { 
    label: language === 'th' ? 'สัญญาณแข็งแกร่ง' : 'Strong Signal', 
    color: '#10b981',
    stars: 3
  }
  if (score >= 60) return { 
    label: language === 'th' ? 'สัญญาณดี' : 'Good Signal', 
    color: '#3b82f6',
    stars: 2
  }
  if (score >= 40) return { 
    label: language === 'th' ? 'สัญญาณปานกลาง' : 'Moderate', 
    color: '#f59e0b',
    stars: 1
  }
  return { 
    label: language === 'th' ? 'สัญญาณอ่อน' : 'Weak Signal', 
    color: '#6b7280',
    stars: 0
  }
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
      if (message.includes('ราคาเข้าโซน') || message.includes('ใกล้โซน') || message.includes('สัญญาณ')) {
        return message
      }
      if (type.startsWith('ob_entry_')) {
        const signal = alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'
        return `ราคาเข้าโซน Order Block - สัญญาณ${signal}`
      }
      if (type.startsWith('ob_near_')) {
        return `ใกล้โซน ${alert.signal} (${alert.distancePct?.toFixed(1) || ''}%)`
      }
      if (type.includes('choch')) {
        return type.includes('bullish') ? 'CHoCH: อาจกลับตัวขึ้น' : 'CHoCH: อาจกลับตัวลง'
      }
      if (type.includes('bos')) {
        return type.includes('bullish') ? 'BOS: ทะลุแนวต้าน' : 'BOS: ทะลุแนวรับ'
      }
      if (type.includes('fvg')) {
        return `FVG ${alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'}`
      }
      if (type === 'zone_premium') return 'อยู่ในโซน Premium - มองหาจุดขาย'
      if (type === 'zone_discount') return 'อยู่ในโซน Discount - มองหาจุดซื้อ'
      return message
    }
    
    // English
    if (type.startsWith('ob_entry_')) {
      return `Price entered Order Block - ${alert.signal} signal`
    }
    if (type.startsWith('ob_near_')) {
      return `Near ${alert.signal} Zone (${alert.distancePct?.toFixed(1) || ''}%)`
    }
    if (type.includes('choch')) {
      return type.includes('bullish') ? 'CHoCH: Potential reversal up' : 'CHoCH: Potential reversal down'
    }
    if (type.includes('bos')) {
      return type.includes('bullish') ? 'BOS: Broke resistance' : 'BOS: Broke support'
    }
    if (type.includes('fvg')) {
      return `FVG ${alert.signal}`
    }
    if (type === 'zone_premium') return 'In Premium Zone - Look for sells'
    if (type === 'zone_discount') return 'In Discount Zone - Look for buys'
    
    return message
  }

  // Collect all alerts from watchlist stocks with quality data
  const alerts: AlertItem[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (stock?.alerts?.length) {
      // Get order blocks for quality data
      const orderBlocks = stock.order_blocks || []
      
      for (const alert of stock.alerts) {
        // Find matching OB for quality info
        let qualityScore = 50
        let volumeConfirmed = false
        let trendAligned = false
        let strength = 'medium'
        
        if (alert.type?.includes('ob_')) {
          // Find the OB that triggered this alert
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchingOB = orderBlocks.find((ob: any) => 
            ob.in_zone || ob.signal === alert.signal
          )
          if (matchingOB) {
            qualityScore = matchingOB.quality_score || 50
            volumeConfirmed = matchingOB.volume?.confirmed || false
            trendAligned = matchingOB.trend_aligned || false
            strength = matchingOB.strength || 'medium'
          }
        }
        
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.signal,
          type: alert.type,
          distancePct: alert.distance_pct,
          level: alert.level,
          ob_high: alert.ob_high,
          ob_low: alert.ob_low,
          qualityScore,
          volumeConfirmed,
          trendAligned,
          strength
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

  // Sort: Entry alerts first (by quality), then near zone, then others
  filteredAlerts.sort((a, b) => {
    const aIsEntry = a.type?.startsWith('ob_entry_')
    const bIsEntry = b.type?.startsWith('ob_entry_')
    if (aIsEntry && !bIsEntry) return -1
    if (!aIsEntry && bIsEntry) return 1
    
    // Both entry: sort by quality
    if (aIsEntry && bIsEntry) {
      return (b.qualityScore || 0) - (a.qualityScore || 0)
    }
    
    const aIsNear = a.type?.startsWith('ob_near_')
    const bIsNear = b.type?.startsWith('ob_near_')
    if (aIsNear && !bIsNear) return -1
    if (!aIsNear && bIsNear) return 1
    
    // Both near: sort by distance
    if (aIsNear && bIsNear) {
      return (a.distancePct || 100) - (b.distancePct || 100)
    }
    
    return 0
  })

  const buyCount = alerts.filter(a => a.signal === 'BUY').length
  const sellCount = alerts.filter(a => a.signal === 'SELL').length

  // Check if alert is OB related (has quality data)
  const isOBAlert = (type: string) => type?.includes('ob_entry_') || type?.includes('ob_near_')

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
            {filteredAlerts.map((alert, i) => {
              const isOB = isOBAlert(alert.type)
              const qualityInfo = isOB ? getQualityInfo(alert.qualityScore || 50, language) : null
              const isEntry = alert.type?.startsWith('ob_entry_')
              
              return (
                <div 
                  key={i} 
                  className={`alert-item ${alert.signal.toLowerCase()} ${isEntry ? 'entry' : ''}`}
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
                      {/* Distance or In Zone badge */}
                      {alert.distancePct !== undefined && alert.distancePct > 0 && isOB && (
                        <span className={`alert-distance ${alert.distancePct <= 2 ? 'near' : ''}`}>
                          {alert.distancePct.toFixed(1)}% {t('away')}
                        </span>
                      )}
                      {isEntry && (
                        <span className="alert-distance near">
                          {language === 'th' ? '🎯 อยู่ในโซน' : '🎯 In Zone'}
                        </span>
                      )}
                    </div>
                    <p className="alert-message">{translateMessage(alert)}</p>
                    
                    {/* Quality indicators for OB alerts */}
                    {isOB && qualityInfo && (
                      <div className="alert-quality">
                        {/* Stars */}
                        <span className="quality-stars" style={{ color: qualityInfo.color }}>
                          {'★'.repeat(qualityInfo.stars)}{'☆'.repeat(3 - qualityInfo.stars)}
                        </span>
                        <span className="quality-label" style={{ color: qualityInfo.color }}>
                          {qualityInfo.label}
                        </span>
                        {/* Confirmation badges */}
                        <div className="quality-badges">
                          {alert.volumeConfirmed && (
                            <span className="quality-badge confirmed" title={language === 'th' ? 'Volume ยืนยัน' : 'Volume Confirmed'}>
                              <BarChart3 size={10} /> Vol
                            </span>
                          )}
                          {alert.trendAligned && (
                            <span className="quality-badge confirmed" title={language === 'th' ? 'ไปตาม Trend' : 'Trend Aligned'}>
                              <TrendIcon size={10} /> Trend
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`badge ${alert.signal === 'BUY' ? 'badge-bull' : 'badge-bear'}`}>
                    {alert.signal === 'BUY' ? t('buy').toUpperCase() : t('sell').toUpperCase()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
