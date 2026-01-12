'use client'

import { Bell, TrendingUp, TrendingDown, Activity, BarChart3, Volume2, ChevronDown, ChevronUp, Target, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'
import { formatPrice } from '@/lib/utils'

type FilterType = 'all' | 'buy' | 'sell'

interface AlertItem {
  symbol: string
  signal: string
  type: string
  // Price data
  currentPrice?: number
  obHigh?: number
  obLow?: number
  distancePct?: number
  // Quality indicators
  qualityScore?: number
  volumeConfirmed?: boolean
  trendAligned?: boolean
  strength?: string
  // Stock context
  rsi?: number
  trend?: string
  trendStrength?: number
  volumeRatio?: number
  emaTrend?: string
}

// Generate smart summary in Thai/English
function getSmartSummary(alert: AlertItem, language: string): { title: string; subtitle: string; reasons: string[] } {
  const isBuy = alert.signal === 'BUY'
  const isEntry = alert.type?.startsWith('ob_entry_')
  const isNear = alert.type?.startsWith('ob_near_')
  
  const reasons: string[] = []
  
  // RSI reason
  if (alert.rsi !== undefined) {
    if (alert.rsi < 30) {
      reasons.push(language === 'th' ? `RSI ${alert.rsi.toFixed(0)} (Oversold)` : `RSI ${alert.rsi.toFixed(0)} (Oversold)`)
    } else if (alert.rsi > 70) {
      reasons.push(language === 'th' ? `RSI ${alert.rsi.toFixed(0)} (Overbought)` : `RSI ${alert.rsi.toFixed(0)} (Overbought)`)
    } else if (alert.rsi < 40 && isBuy) {
      reasons.push(language === 'th' ? `RSI ${alert.rsi.toFixed(0)} ต่ำ` : `RSI ${alert.rsi.toFixed(0)} Low`)
    } else if (alert.rsi > 60 && !isBuy) {
      reasons.push(language === 'th' ? `RSI ${alert.rsi.toFixed(0)} สูง` : `RSI ${alert.rsi.toFixed(0)} High`)
    }
  }
  
  // Volume reason
  if (alert.volumeConfirmed || (alert.volumeRatio && alert.volumeRatio > 1.5)) {
    reasons.push(language === 'th' ? 'Volume ยืนยัน' : 'Volume Confirmed')
  }
  
  // Trend reason
  if (alert.trendAligned) {
    reasons.push(language === 'th' ? 'ตาม Trend' : 'Trend Aligned')
  }
  
  // Quality reason
  if (alert.qualityScore && alert.qualityScore >= 70) {
    reasons.push(language === 'th' ? 'คุณภาพสูง' : 'High Quality')
  }
  
  // Generate title
  let title = ''
  let subtitle = ''
  
  if (isEntry) {
    if (language === 'th') {
      title = isBuy ? '🎯 จุดเข้าซื้อ!' : '🎯 จุดขาย!'
      subtitle = `ราคาเข้าโซน Order Block`
    } else {
      title = isBuy ? '🎯 Buy Entry!' : '🎯 Sell Entry!'
      subtitle = `Price entered Order Block`
    }
  } else if (isNear) {
    if (language === 'th') {
      title = isBuy ? '⚠️ ใกล้จุดซื้อ' : '⚠️ ใกล้จุดขาย'
      subtitle = `อีก ${alert.distancePct?.toFixed(1)}% ถึงโซน`
    } else {
      title = isBuy ? '⚠️ Near Buy Zone' : '⚠️ Near Sell Zone'
      subtitle = `${alert.distancePct?.toFixed(1)}% away`
    }
  } else if (alert.type?.includes('choch')) {
    if (language === 'th') {
      title = isBuy ? '🔄 อาจกลับตัวขึ้น' : '🔄 อาจกลับตัวลง'
      subtitle = 'Change of Character (CHoCH)'
    } else {
      title = isBuy ? '🔄 Potential Reversal Up' : '🔄 Potential Reversal Down'
      subtitle = 'Change of Character (CHoCH)'
    }
  } else if (alert.type?.includes('bos')) {
    if (language === 'th') {
      title = isBuy ? '💥 ทะลุแนวต้าน' : '💥 ทะลุแนวรับ'
      subtitle = 'Break of Structure (BOS)'
    } else {
      title = isBuy ? '💥 Broke Resistance' : '💥 Broke Support'
      subtitle = 'Break of Structure (BOS)'
    }
  } else {
    title = language === 'th' 
      ? (isBuy ? 'สัญญาณซื้อ' : 'สัญญาณขาย')
      : (isBuy ? 'Buy Signal' : 'Sell Signal')
    subtitle = alert.type || ''
  }
  
  return { title, subtitle, reasons }
}

// Get confidence level
function getConfidence(alert: AlertItem): { level: string; color: string; percent: number } {
  let score = 0
  
  // Base score from quality
  score += (alert.qualityScore || 50) * 0.4
  
  // Bonus for confirmations
  if (alert.volumeConfirmed) score += 15
  if (alert.trendAligned) score += 15
  
  // RSI alignment bonus
  if (alert.rsi !== undefined) {
    const isBuy = alert.signal === 'BUY'
    if (isBuy && alert.rsi < 40) score += 10
    if (!isBuy && alert.rsi > 60) score += 10
  }
  
  // Entry vs Near bonus
  if (alert.type?.startsWith('ob_entry_')) score += 10
  
  const percent = Math.min(100, Math.round(score))
  
  if (percent >= 75) return { level: 'สูง', color: '#10b981', percent }
  if (percent >= 50) return { level: 'ปานกลาง', color: '#f59e0b', percent }
  return { level: 'ต่ำ', color: '#6b7280', percent }
}

export default function AlertsView() {
  const { watchlist, smcData } = useStore()
  const { t, language } = useTranslation()
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null)

  // Collect all alerts with full context
  const alerts: AlertItem[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (!stock?.alerts?.length) continue
    
    const orderBlocks = stock.order_blocks || []
    const hasOBEntry = stock.alerts.some((a: { type?: string }) => a.type?.startsWith('ob_entry_'))
    
    for (const alert of stock.alerts) {
      // Skip redundant zone alerts
      if (hasOBEntry && (alert.type === 'zone_premium' || alert.type === 'zone_discount')) {
        continue
      }
      
      // Get quality data from matching OB
      let qualityScore = 50
      let volumeConfirmed = false
      let trendAligned = false
      let strength = 'medium'
      
      if (alert.type?.includes('ob_')) {
        const matchingOB = orderBlocks.find((ob: { in_zone?: boolean; signal?: string }) => 
          ob.in_zone || ob.signal === alert.signal
        )
        if (matchingOB) {
          qualityScore = matchingOB.quality_score || 50
          volumeConfirmed = matchingOB.volume?.confirmed === true || matchingOB.volume?.confirmed === 'True'
          trendAligned = matchingOB.trend_aligned || false
          strength = matchingOB.strength || 'medium'
        }
      }
      
      alerts.push({
        symbol,
        signal: alert.signal,
        type: alert.type,
        currentPrice: stock.current_price,
        obHigh: alert.ob_high,
        obLow: alert.ob_low,
        distancePct: alert.distance_pct,
        qualityScore,
        volumeConfirmed,
        trendAligned,
        strength,
        // Stock context
        rsi: stock.indicators?.rsi?.value,
        trend: stock.trend?.direction,
        trendStrength: stock.trend?.strength,
        volumeRatio: stock.indicators?.volume?.ratio,
        emaTrend: stock.ema_trend?.trend
      })
    }
  }

  // Filter
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true
    if (filter === 'buy') return alert.signal === 'BUY'
    if (filter === 'sell') return alert.signal === 'SELL'
    return true
  })

  // Sort: Entry first (by confidence), then near, then others
  filteredAlerts.sort((a, b) => {
    const aIsEntry = a.type?.startsWith('ob_entry_')
    const bIsEntry = b.type?.startsWith('ob_entry_')
    if (aIsEntry && !bIsEntry) return -1
    if (!aIsEntry && bIsEntry) return 1
    
    if (aIsEntry && bIsEntry) {
      return getConfidence(b).percent - getConfidence(a).percent
    }
    
    const aIsNear = a.type?.startsWith('ob_near_')
    const bIsNear = b.type?.startsWith('ob_near_')
    if (aIsNear && !bIsNear) return -1
    if (!aIsNear && bIsNear) return 1
    
    return 0
  })

  const buyCount = alerts.filter(a => a.signal === 'BUY').length
  const sellCount = alerts.filter(a => a.signal === 'SELL').length
  const entryCount = alerts.filter(a => a.type?.startsWith('ob_entry_')).length

  return (
    <main className="alerts-page">
      {/* Summary Header */}
      <div className="alerts-summary-header">
        {entryCount > 0 ? (
          <div className="alerts-highlight">
            <Target size={20} />
            <span>
              {language === 'th' 
                ? `${entryCount} สัญญาณเข้าจุด!` 
                : `${entryCount} Entry Signal${entryCount > 1 ? 's' : ''}!`}
            </span>
          </div>
        ) : (
          <div className="alerts-highlight muted">
            <Bell size={20} />
            <span>{language === 'th' ? 'ไม่มีสัญญาณเข้าจุด' : 'No Entry Signals'}</span>
          </div>
        )}
        
        <div className="alerts-counts">
          <span className="count-badge buy">
            <TrendingUp size={14} /> {buyCount}
          </span>
          <span className="count-badge sell">
            <TrendingDown size={14} /> {sellCount}
          </span>
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
      <div className="alerts-list-v2">
        {filteredAlerts.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Bell size={28} />
              </div>
              <h3>{t('no_alerts_yet')}</h3>
              <p>{t('add_stocks_alerts')}</p>
            </div>
          </div>
        ) : (
          filteredAlerts.map((alert, i) => {
            const { title, subtitle, reasons } = getSmartSummary(alert, language)
            const confidence = getConfidence(alert)
            const isEntry = alert.type?.startsWith('ob_entry_')
            const isBuy = alert.signal === 'BUY'
            const isExpanded = expandedAlert === i
            const logoUrl = `https://assets.parqet.com/logos/symbol/${alert.symbol}?format=png`
            
            return (
              <div 
                key={i} 
                className={`alert-card-v2 ${isBuy ? 'buy' : 'sell'} ${isEntry ? 'entry' : ''}`}
              >
                {/* Main Content */}
                <div className="alert-card-main">
                  <div className="alert-card-left">
                    <img 
                      src={logoUrl} 
                      alt={alert.symbol}
                      className="alert-logo"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="alert-card-info">
                      <div className="alert-card-symbol">
                        {alert.symbol}
                        <span className={`signal-tag ${isBuy ? 'buy' : 'sell'}`}>
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                      </div>
                      <div className="alert-card-title">{title}</div>
                      <div className="alert-card-subtitle">{subtitle}</div>
                    </div>
                  </div>
                  
                  <div className="alert-card-right">
                    {/* Confidence Meter */}
                    <div className="confidence-meter">
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill"
                          style={{ 
                            width: `${confidence.percent}%`,
                            backgroundColor: confidence.color
                          }}
                        />
                      </div>
                      <span className="confidence-label" style={{ color: confidence.color }}>
                        {confidence.percent}%
                      </span>
                    </div>
                    
                    {/* Price Info */}
                    {alert.currentPrice && (
                      <div className="alert-price">
                        ${formatPrice(alert.currentPrice)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Quick Reasons */}
                {reasons.length > 0 && (
                  <div className="alert-reasons">
                    {reasons.map((reason, j) => (
                      <span key={j} className="reason-tag">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Expand Button */}
                <button 
                  className="alert-expand-btn"
                  onClick={() => setExpandedAlert(isExpanded ? null : i)}
                >
                  {isExpanded 
                    ? (language === 'th' ? 'ซ่อนรายละเอียด' : 'Hide Details')
                    : (language === 'th' ? 'ดูรายละเอียด' : 'View Details')
                  }
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="alert-details">
                    {/* Price Zone */}
                    {alert.obHigh && alert.obLow && (
                      <div className="detail-row">
                        <span className="detail-label">
                          {language === 'th' ? 'โซนราคา' : 'Price Zone'}
                        </span>
                        <span className="detail-value">
                          ${formatPrice(alert.obLow)} - ${formatPrice(alert.obHigh)}
                        </span>
                      </div>
                    )}
                    
                    {/* RSI */}
                    {alert.rsi !== undefined && (
                      <div className="detail-row">
                        <span className="detail-label">
                          <Activity size={12} /> RSI
                        </span>
                        <span className={`detail-value ${alert.rsi < 30 ? 'oversold' : alert.rsi > 70 ? 'overbought' : ''}`}>
                          {alert.rsi.toFixed(1)}
                          {alert.rsi < 30 && ' (Oversold)'}
                          {alert.rsi > 70 && ' (Overbought)'}
                        </span>
                      </div>
                    )}
                    
                    {/* Trend */}
                    {alert.trend && (
                      <div className="detail-row">
                        <span className="detail-label">
                          {alert.trend === 'bullish' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {language === 'th' ? 'เทรนด์' : 'Trend'}
                        </span>
                        <span className={`detail-value ${alert.trend}`}>
                          {alert.trend === 'bullish' 
                            ? (language === 'th' ? 'ขาขึ้น' : 'Bullish')
                            : alert.trend === 'bearish'
                            ? (language === 'th' ? 'ขาลง' : 'Bearish')
                            : (language === 'th' ? 'ไม่ชัดเจน' : 'Neutral')
                          }
                          {alert.trendStrength !== undefined && ` (${(alert.trendStrength * 100).toFixed(0)}%)`}
                        </span>
                      </div>
                    )}
                    
                    {/* Volume */}
                    {alert.volumeRatio !== undefined && (
                      <div className="detail-row">
                        <span className="detail-label">
                          <Volume2 size={12} /> Volume
                        </span>
                        <span className={`detail-value ${alert.volumeRatio > 1.5 ? 'high' : ''}`}>
                          {alert.volumeRatio.toFixed(2)}x
                          {alert.volumeRatio > 1.5 && (language === 'th' ? ' (สูง)' : ' (High)')}
                        </span>
                      </div>
                    )}
                    
                    {/* Quality Score */}
                    <div className="detail-row">
                      <span className="detail-label">
                        <BarChart3 size={12} /> {language === 'th' ? 'คุณภาพ OB' : 'OB Quality'}
                      </span>
                      <span className="detail-value">
                        {alert.qualityScore}%
                        {alert.strength && ` (${alert.strength})`}
                      </span>
                    </div>
                    
                    {/* Confirmations */}
                    <div className="detail-confirmations">
                      <span className={`confirm-badge ${alert.volumeConfirmed ? 'confirmed' : 'not'}`}>
                        <BarChart3 size={10} />
                        {language === 'th' ? 'Volume' : 'Volume'}
                      </span>
                      <span className={`confirm-badge ${alert.trendAligned ? 'confirmed' : 'not'}`}>
                        <TrendingUp size={10} />
                        {language === 'th' ? 'Trend' : 'Trend'}
                      </span>
                    </div>
                    
                    {/* Warning if not aligned */}
                    {!alert.trendAligned && alert.type?.startsWith('ob_entry_') && (
                      <div className="alert-warning">
                        <AlertTriangle size={14} />
                        <span>
                          {language === 'th' 
                            ? 'สัญญาณสวนทาง Trend - ระวังความเสี่ยง'
                            : 'Counter-trend signal - Higher risk'
                          }
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
