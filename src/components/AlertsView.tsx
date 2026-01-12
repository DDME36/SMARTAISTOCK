'use client'

import { Bell, TrendingUp, TrendingDown, Activity, Volume2, ChevronDown, ChevronUp, Target, AlertTriangle, CheckCircle, XCircle, MinusCircle, Minus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { useLivePrices } from '@/hooks/useLivePrices'

type FilterType = 'all' | 'buy' | 'sell' | 'mixed'

interface SingleAlert {
  type: string
  signal: string
  priority: string
  distancePct?: number
  obHigh?: number
  obLow?: number
  qualityScore?: number
  volumeConfirmed?: boolean
  trendAligned?: boolean
  strength?: string
}

interface StockAlertGroup {
  symbol: string
  alerts: SingleAlert[]
  // Aggregated data
  currentPrice?: number
  priceChange?: number
  rsi?: number
  trend?: string
  trendStrength?: number
  volumeRatio?: number
  // Analysis result
  consensus: 'BUY' | 'SELL' | 'MIXED' | 'HOLD'
  confidence: number
  buySignals: number
  sellSignals: number
  primaryAlert: SingleAlert
}

// Priority order for alerts
const ALERT_PRIORITY: Record<string, number> = {
  'ob_entry_bullish': 1,
  'ob_entry_bearish': 1,
  'choch_bullish': 2,
  'choch_bearish': 2,
  'ob_near_bullish': 3,
  'ob_near_bearish': 3,
  'bos_bullish': 4,
  'bos_bearish': 4,
  'fvg_bullish': 5,
  'fvg_bearish': 5,
  'zone_premium': 6,
  'zone_discount': 6
}

// Analyze all alerts and determine consensus
function analyzeAlerts(alerts: SingleAlert[]): { consensus: 'BUY' | 'SELL' | 'MIXED' | 'HOLD'; confidence: number; buySignals: number; sellSignals: number } {
  let buyScore = 0
  let sellScore = 0
  let buyCount = 0
  let sellCount = 0
  
  for (const alert of alerts) {
    const weight = alert.type.startsWith('ob_entry_') ? 3 
                 : alert.type.startsWith('choch_') ? 2.5
                 : alert.type.startsWith('ob_near_') ? 2
                 : alert.type.startsWith('bos_') ? 1.5
                 : alert.type.startsWith('fvg_') ? 1
                 : 0.5 // zone alerts
    
    const qualityBonus = (alert.qualityScore || 50) / 100
    const confirmBonus = (alert.volumeConfirmed ? 0.2 : 0) + (alert.trendAligned ? 0.2 : 0)
    const totalWeight = weight * (1 + qualityBonus + confirmBonus)
    
    if (alert.signal === 'BUY') {
      buyScore += totalWeight
      buyCount++
    } else if (alert.signal === 'SELL') {
      sellScore += totalWeight
      sellCount++
    }
  }
  
  const totalScore = buyScore + sellScore
  const diff = Math.abs(buyScore - sellScore)
  const ratio = totalScore > 0 ? diff / totalScore : 0
  
  // Determine consensus
  let consensus: 'BUY' | 'SELL' | 'MIXED' | 'HOLD'
  let confidence: number
  
  if (totalScore === 0) {
    consensus = 'HOLD'
    confidence = 0
  } else if (ratio < 0.3) {
    // Signals are too close - mixed
    consensus = 'MIXED'
    confidence = Math.round(50 + ratio * 50)
  } else if (buyScore > sellScore) {
    consensus = 'BUY'
    confidence = Math.round(50 + ratio * 50)
  } else {
    consensus = 'SELL'
    confidence = Math.round(50 + ratio * 50)
  }
  
  return { consensus, confidence, buySignals: buyCount, sellSignals: sellCount }
}

// Get alert display info
function getAlertInfo(alert: SingleAlert, language: string): { icon: string; label: string; color: string } {
  const type = alert.type
  const isBuy = alert.signal === 'BUY'
  
  if (type.startsWith('ob_entry_')) {
    return { 
      icon: '🎯', 
      label: language === 'th' ? 'เข้า Order Block' : 'OB Entry',
      color: isBuy ? '#10b981' : '#ef4444'
    }
  }
  if (type.startsWith('ob_near_')) {
    return { 
      icon: '⚠️', 
      label: language === 'th' ? `ใกล้ OB (${alert.distancePct?.toFixed(1)}%)` : `Near OB (${alert.distancePct?.toFixed(1)}%)`,
      color: '#f59e0b'
    }
  }
  if (type.includes('choch')) {
    return { 
      icon: '🔄', 
      label: language === 'th' ? 'CHoCH กลับตัว' : 'CHoCH Reversal',
      color: '#8b5cf6'
    }
  }
  if (type.includes('bos')) {
    return { 
      icon: '💥', 
      label: language === 'th' ? 'BOS ทะลุ' : 'BOS Break',
      color: '#3b82f6'
    }
  }
  if (type.includes('fvg')) {
    return { 
      icon: '📊', 
      label: 'FVG',
      color: '#6366f1'
    }
  }
  if (type === 'zone_premium') {
    return { 
      icon: '📍', 
      label: language === 'th' ? 'โซน Premium' : 'Premium Zone',
      color: '#ef4444'
    }
  }
  if (type === 'zone_discount') {
    return { 
      icon: '📍', 
      label: language === 'th' ? 'โซน Discount' : 'Discount Zone',
      color: '#10b981'
    }
  }
  
  return { icon: '📌', label: type, color: '#6b7280' }
}

// Get consensus display
function getConsensusDisplay(consensus: string, language: string): { label: string; color: string; bgColor: string; icon: typeof CheckCircle } {
  switch (consensus) {
    case 'BUY':
      return { 
        label: language === 'th' ? 'แนะนำซื้อ' : 'BUY', 
        color: '#10b981', 
        bgColor: 'rgba(16, 185, 129, 0.15)',
        icon: CheckCircle
      }
    case 'SELL':
      return { 
        label: language === 'th' ? 'แนะนำขาย' : 'SELL', 
        color: '#ef4444', 
        bgColor: 'rgba(239, 68, 68, 0.15)',
        icon: XCircle
      }
    case 'MIXED':
      return { 
        label: language === 'th' ? 'สัญญาณขัดแย้ง' : 'MIXED', 
        color: '#f59e0b', 
        bgColor: 'rgba(245, 158, 11, 0.15)',
        icon: AlertTriangle
      }
    default:
      return { 
        label: language === 'th' ? 'รอดู' : 'HOLD', 
        color: '#6b7280', 
        bgColor: 'rgba(107, 114, 128, 0.15)',
        icon: MinusCircle
      }
  }
}

export default function AlertsView() {
  const { watchlist, smcData } = useStore()
  const { t, language } = useTranslation()
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedStock, setExpandedStock] = useState<string | null>(null)
  
  const { prices: livePrices } = useLivePrices(watchlist)

  // Group alerts by symbol
  const stockGroups: StockAlertGroup[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (!stock?.alerts?.length) continue
    
    const orderBlocks = stock.order_blocks || []
    const livePrice = livePrices[symbol]?.price
    const priceChange = livePrices[symbol]?.change
    
    // Collect all alerts for this stock
    const alerts: SingleAlert[] = []
    
    for (const alert of stock.alerts) {
      let qualityScore = 50
      let volumeConfirmed = false
      let trendAligned = false
      let strength = 'medium'
      
      if (alert.type?.includes('ob_')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchingOB = orderBlocks.find((ob: any) => 
          ob.in_zone || ob.signal === alert.signal
        )
        if (matchingOB) {
          qualityScore = matchingOB.quality_score || 50
          const confirmed = matchingOB.volume?.confirmed
          volumeConfirmed = confirmed === true || String(confirmed) === 'True'
          trendAligned = matchingOB.trend_aligned || false
          strength = matchingOB.strength || 'medium'
        }
      }
      
      alerts.push({
        type: alert.type,
        signal: alert.signal,
        priority: alert.priority || 'low',
        distancePct: alert.distance_pct,
        obHigh: alert.ob_high,
        obLow: alert.ob_low,
        qualityScore,
        volumeConfirmed,
        trendAligned,
        strength
      })
    }
    
    // Sort alerts by priority
    alerts.sort((a, b) => (ALERT_PRIORITY[a.type] || 99) - (ALERT_PRIORITY[b.type] || 99))
    
    // Analyze and get consensus
    const analysis = analyzeAlerts(alerts)
    
    stockGroups.push({
      symbol,
      alerts,
      currentPrice: livePrice || stock.current_price,
      priceChange,
      rsi: stock.indicators?.rsi?.value,
      trend: typeof stock.trend === 'string' ? stock.trend : stock.trend?.direction,
      trendStrength: typeof stock.trend === 'object' ? stock.trend?.strength : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      volumeRatio: (stock.indicators as any)?.volume?.ratio,
      consensus: analysis.consensus,
      confidence: analysis.confidence,
      buySignals: analysis.buySignals,
      sellSignals: analysis.sellSignals,
      primaryAlert: alerts[0]
    })
  }

  // Filter
  const filteredGroups = stockGroups.filter(group => {
    if (filter === 'all') return true
    if (filter === 'buy') return group.consensus === 'BUY'
    if (filter === 'sell') return group.consensus === 'SELL'
    if (filter === 'mixed') return group.consensus === 'MIXED'
    return true
  })

  // Sort: Entry alerts first, then by confidence
  filteredGroups.sort((a, b) => {
    const aHasEntry = a.alerts.some(al => al.type.startsWith('ob_entry_'))
    const bHasEntry = b.alerts.some(al => al.type.startsWith('ob_entry_'))
    if (aHasEntry && !bHasEntry) return -1
    if (!aHasEntry && bHasEntry) return 1
    return b.confidence - a.confidence
  })

  const buyCount = stockGroups.filter(g => g.consensus === 'BUY').length
  const sellCount = stockGroups.filter(g => g.consensus === 'SELL').length
  const mixedCount = stockGroups.filter(g => g.consensus === 'MIXED').length
  const entryCount = stockGroups.filter(g => g.alerts.some(a => a.type.startsWith('ob_entry_'))).length

  return (
    <main className="alerts-page">
      {/* Summary Header */}
      <div className="alerts-summary-header">
        {entryCount > 0 ? (
          <div className="alerts-highlight">
            <Target size={20} />
            <span>
              {language === 'th' 
                ? `${entryCount} หุ้นเข้าจุด!` 
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
          {mixedCount > 0 && (
            <span className="count-badge mixed">
              <AlertTriangle size={14} /> {mixedCount}
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="alerts-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('all')} ({stockGroups.length})
        </button>
        <button 
          className={`filter-btn buy ${filter === 'buy' ? 'active' : ''}`}
          onClick={() => setFilter('buy')}
        >
          {language === 'th' ? 'ซื้อ' : 'Buy'} ({buyCount})
        </button>
        <button 
          className={`filter-btn sell ${filter === 'sell' ? 'active' : ''}`}
          onClick={() => setFilter('sell')}
        >
          {language === 'th' ? 'ขาย' : 'Sell'} ({sellCount})
        </button>
        {mixedCount > 0 && (
          <button 
            className={`filter-btn mixed ${filter === 'mixed' ? 'active' : ''}`}
            onClick={() => setFilter('mixed')}
          >
            {language === 'th' ? 'ขัดแย้ง' : 'Mixed'} ({mixedCount})
          </button>
        )}
      </div>

      {/* Stock Alert Cards */}
      <div className="alerts-list-v2">
        {filteredGroups.length === 0 ? (
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
          filteredGroups.map((group) => {
            const consensusDisplay = getConsensusDisplay(group.consensus, language)
            const ConsensusIcon = consensusDisplay.icon
            const isExpanded = expandedStock === group.symbol
            const logoUrl = `https://assets.parqet.com/logos/symbol/${group.symbol}?format=png`
            const hasEntry = group.alerts.some(a => a.type.startsWith('ob_entry_'))
            
            return (
              <div 
                key={group.symbol} 
                className={`alert-card-v2 ${group.consensus.toLowerCase()} ${hasEntry ? 'entry' : ''}`}
              >
                {/* Main Content */}
                <div className="alert-card-main">
                  <div className="alert-card-left">
                    <img 
                      src={logoUrl} 
                      alt={group.symbol}
                      className="alert-logo"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="alert-card-info">
                      <div className="alert-card-symbol">
                        {group.symbol}
                        <span 
                          className="consensus-tag"
                          style={{ background: consensusDisplay.bgColor, color: consensusDisplay.color }}
                        >
                          <ConsensusIcon size={12} />
                          {consensusDisplay.label}
                        </span>
                      </div>
                      <div className="alert-card-summary">
                        {language === 'th' 
                          ? `${group.buySignals} สัญญาณซื้อ • ${group.sellSignals} สัญญาณขาย`
                          : `${group.buySignals} buy • ${group.sellSignals} sell signals`
                        }
                      </div>
                      {/* Primary alert preview */}
                      <div className="alert-primary-preview">
                        {(() => {
                          const info = getAlertInfo(group.primaryAlert, language)
                          return (
                            <span style={{ color: info.color }}>
                              {info.icon} {info.label}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert-card-right">
                    {/* Confidence */}
                    <div className="confidence-meter">
                      <div className="confidence-bar">
                        <div 
                          className="confidence-fill"
                          style={{ 
                            width: `${group.confidence}%`,
                            backgroundColor: consensusDisplay.color
                          }}
                        />
                      </div>
                      <span className="confidence-label" style={{ color: consensusDisplay.color }}>
                        {group.confidence}%
                      </span>
                    </div>
                    
                    {/* Price */}
                    {group.currentPrice && (
                      <div className="alert-price-block">
                        <div className="alert-price">
                          ${formatPrice(group.currentPrice)}
                        </div>
                        {group.priceChange !== undefined && (
                          <div className={`alert-price-change ${group.priceChange > 0 ? 'up' : group.priceChange < 0 ? 'down' : ''}`}>
                            {group.priceChange > 0 ? '+' : ''}{group.priceChange.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Expand Button */}
                <button 
                  className="alert-expand-btn"
                  onClick={() => setExpandedStock(isExpanded ? null : group.symbol)}
                >
                  {isExpanded 
                    ? (language === 'th' ? 'ซ่อนรายละเอียด' : 'Hide Details')
                    : (language === 'th' ? `ดูทั้ง ${group.alerts.length} สัญญาณ` : `View all ${group.alerts.length} signals`)
                  }
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="alert-details">
                    {/* All Signals */}
                    <div className="signals-list">
                      <div className="signals-list-title">
                        {language === 'th' ? 'สัญญาณทั้งหมด' : 'All Signals'}
                      </div>
                      {group.alerts.map((alert, idx) => {
                        const info = getAlertInfo(alert, language)
                        return (
                          <div key={idx} className={`signal-item ${alert.signal.toLowerCase()}`}>
                            <span className="signal-icon">{info.icon}</span>
                            <span className="signal-label">{info.label}</span>
                            <span className={`signal-direction ${alert.signal.toLowerCase()}`}>
                              {alert.signal === 'BUY' 
                                ? (language === 'th' ? 'ซื้อ' : 'BUY')
                                : (language === 'th' ? 'ขาย' : 'SELL')
                              }
                            </span>
                            {alert.qualityScore && alert.qualityScore >= 60 && (
                              <span className="signal-quality">★{Math.round(alert.qualityScore/33)}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Indicators */}
                    <div className="indicators-grid">
                      {group.rsi !== undefined && (
                        <div className="indicator-item">
                          <Activity size={14} />
                          <span>RSI</span>
                          <span className={group.rsi < 30 ? 'oversold' : group.rsi > 70 ? 'overbought' : ''}>
                            {group.rsi.toFixed(0)}
                          </span>
                        </div>
                      )}
                      <div className="indicator-item">
                        {group.trend === 'bullish' ? (
                          <TrendingUp size={14} className="trend-icon bullish" />
                        ) : group.trend === 'bearish' ? (
                          <TrendingDown size={14} className="trend-icon bearish" />
                        ) : (
                          <Minus size={14} className="trend-icon neutral" />
                        )}
                        <span>{language === 'th' ? 'เทรนด์' : 'Trend'}</span>
                        <span className={`trend-value ${group.trend || 'neutral'}`}>
                          {group.trend === 'bullish' 
                            ? (language === 'th' ? 'ขาขึ้น' : 'Up')
                            : group.trend === 'bearish' 
                            ? (language === 'th' ? 'ขาลง' : 'Down')
                            : (language === 'th' ? 'ทรงตัว' : 'Flat')
                          }
                        </span>
                      </div>
                      {group.volumeRatio !== undefined && (
                        <div className="indicator-item">
                          <Volume2 size={14} />
                          <span>Vol</span>
                          <span className={group.volumeRatio > 1.5 ? 'high' : ''}>
                            {group.volumeRatio.toFixed(1)}x
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Warning for mixed signals */}
                    {group.consensus === 'MIXED' && (
                      <div className="alert-warning">
                        <AlertTriangle size={14} />
                        <span>
                          {language === 'th' 
                            ? 'สัญญาณขัดแย้งกัน - ควรรอความชัดเจน หรือลดขนาดการเทรด'
                            : 'Conflicting signals - Wait for clarity or reduce position size'
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
