'use client'

import { Bell, TrendingUp, TrendingDown, Activity, Volume2, Target, AlertTriangle, CheckCircle, XCircle, MinusCircle, Minus, X, Crosshair, RefreshCw, Navigation, Zap, BarChart3, MapPin, ChevronRight, DollarSign, ArrowUpRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/utils'
import { useLivePrices } from '@/hooks/useLivePrices'
import { createPortal } from 'react-dom'

type FilterType = 'all' | 'buy' | 'sell' | 'mixed'

interface SingleAlert {
  type: string
  signal: string
  priority: string
  distancePct?: number
  qualityScore?: number
  volumeConfirmed?: boolean
  trendAligned?: boolean
}

interface StockAlertGroup {
  symbol: string
  alerts: SingleAlert[]
  currentPrice?: number
  priceChange?: number
  rsi?: number
  trend?: string
  volumeRatio?: number
  consensus: 'BUY' | 'SELL' | 'MIXED' | 'HOLD'
  confidence: number
  buySignals: number
  sellSignals: number
  primaryAlert: SingleAlert
  positionScore?: {
    score: number
    action: string
    action_th: string
    summary: string
    reasons: Array<{ type: string; message: string }>
  }
  zone?: string
}

const ALERT_PRIORITY: Record<string, number> = {
  'ob_entry_bullish': 1, 'ob_entry_bearish': 1,
  'choch_bullish': 2, 'choch_bearish': 2,
  'ob_near_bullish': 3, 'ob_near_bearish': 3,
  'bos_bullish': 4, 'bos_bearish': 4,
  'fvg_bullish': 5, 'fvg_bearish': 5,
  'zone_premium': 6, 'zone_discount': 6
}

// Icon mapping for alerts - using Lucide icons instead of emoji
const ALERT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'ob_entry': Crosshair,
  'ob_near': Target,
  'choch': RefreshCw,
  'bos': Zap,
  'fvg': BarChart3,
  'zone': MapPin
}

function analyzeAlerts(alerts: SingleAlert[]) {
  let buyScore = 0, sellScore = 0, buyCount = 0, sellCount = 0
  
  for (const alert of alerts) {
    const weight = alert.type.startsWith('ob_entry_') ? 3 
      : alert.type.startsWith('choch_') ? 2.5
      : alert.type.startsWith('ob_near_') ? 2
      : alert.type.startsWith('bos_') ? 1.5
      : alert.type.startsWith('fvg_') ? 1 : 0.5
    
    const bonus = ((alert.qualityScore || 50) / 100) + (alert.volumeConfirmed ? 0.2 : 0) + (alert.trendAligned ? 0.2 : 0)
    const total = weight * (1 + bonus)
    
    if (alert.signal === 'BUY') { buyScore += total; buyCount++ }
    else if (alert.signal === 'SELL') { sellScore += total; sellCount++ }
  }
  
  const totalScore = buyScore + sellScore
  const ratio = totalScore > 0 ? Math.abs(buyScore - sellScore) / totalScore : 0
  
  let consensus: 'BUY' | 'SELL' | 'MIXED' | 'HOLD' = 'HOLD'
  let confidence = 0
  
  if (totalScore > 0) {
    if (ratio < 0.3) { consensus = 'MIXED'; confidence = Math.round(50 + ratio * 50) }
    else if (buyScore > sellScore) { consensus = 'BUY'; confidence = Math.round(50 + ratio * 50) }
    else { consensus = 'SELL'; confidence = Math.round(50 + ratio * 50) }
  }
  
  return { consensus, confidence, buySignals: buyCount, sellSignals: sellCount }
}

function getAlertInfo(alert: SingleAlert, language: string) {
  const type = alert.type
  const isBuy = alert.signal === 'BUY'
  
  if (type.startsWith('ob_entry_')) return { Icon: Crosshair, label: language === 'th' ? 'เข้า Order Block' : 'OB Entry', color: isBuy ? '#10b981' : '#ef4444' }
  if (type.startsWith('ob_near_')) return { Icon: Target, label: language === 'th' ? `ใกล้ OB (${alert.distancePct?.toFixed(1)}%)` : `Near OB (${alert.distancePct?.toFixed(1)}%)`, color: '#f59e0b' }
  if (type.includes('choch')) return { Icon: RefreshCw, label: language === 'th' ? 'CHoCH กลับตัว' : 'CHoCH Reversal', color: '#8b5cf6' }
  if (type.includes('bos')) return { Icon: Zap, label: language === 'th' ? 'BOS ทะลุ' : 'BOS Break', color: '#3b82f6' }
  if (type.includes('fvg')) return { Icon: BarChart3, label: 'FVG', color: '#6366f1' }
  if (type === 'zone_premium') return { Icon: ArrowUpRight, label: language === 'th' ? 'โซน Premium' : 'Premium Zone', color: '#ef4444' }
  if (type === 'zone_discount') return { Icon: DollarSign, label: language === 'th' ? 'โซน Discount' : 'Discount Zone', color: '#10b981' }
  return { Icon: MapPin, label: type, color: '#6b7280' }
}

function getConsensusDisplay(consensus: string, language: string) {
  switch (consensus) {
    case 'BUY': return { label: language === 'th' ? 'แนะนำซื้อ' : 'BUY', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle }
    case 'SELL': return { label: language === 'th' ? 'แนะนำขาย' : 'SELL', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: XCircle }
    case 'MIXED': return { label: language === 'th' ? 'สัญญาณขัดแย้ง' : 'MIXED', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: AlertTriangle }
    default: return { label: language === 'th' ? 'รอดู' : 'HOLD', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)', icon: MinusCircle }
  }
}

// Detail Modal Component
function DetailModal({ group, language, onClose }: { group: StockAlertGroup; language: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  
  if (!mounted) return null
  
  const consensusDisplay = getConsensusDisplay(group.consensus, language)
  const logoUrl = `https://assets.parqet.com/logos/symbol/${group.symbol}?format=png`
  
  const modal = (
    <div className="alert-modal-overlay" onClick={onClose}>
      <div className="alert-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="alert-modal-header">
          <div className="alert-modal-title">
            <img src={logoUrl} alt={group.symbol} className="alert-modal-logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div>
              <div className="alert-modal-symbol">{group.symbol}</div>
              <div className="alert-modal-price">
                ${group.currentPrice ? formatPrice(group.currentPrice) : '...'}
                {group.priceChange !== undefined && (
                  <span className={group.priceChange > 0 ? 'up' : group.priceChange < 0 ? 'down' : ''}>
                    {group.priceChange > 0 ? '+' : ''}{group.priceChange.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="alert-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        
        {/* Position Score */}
        {group.positionScore && (
          <div className={`position-score-compact ${group.positionScore.action.toLowerCase().replace('_', '-')}`}>
            <div className="psc-left">
              <div className="psc-action">{group.positionScore.action_th || group.positionScore.action}</div>
              <div className="psc-summary">{group.positionScore.summary}</div>
            </div>
            <div className="psc-score">{group.positionScore.score}<span>/100</span></div>
          </div>
        )}
        
        {/* Signals */}
        <div className="alert-modal-section">
          <div className="alert-modal-section-title">{language === 'th' ? 'สัญญาณทั้งหมด' : 'All Signals'}</div>
          <div className="signal-list-compact">
            {group.alerts.map((alert, idx) => {
              const info = getAlertInfo(alert, language)
              const AlertIcon = info.Icon
              return (
                <div key={idx} className="signal-row">
                  <span className="signal-icon" style={{ color: info.color }}><AlertIcon size={14} /></span>
                  <span className="signal-name">{info.label}</span>
                  <span className={`signal-badge ${alert.signal.toLowerCase()}`}>
                    {alert.signal === 'BUY' ? (language === 'th' ? 'ซื้อ' : 'BUY') : (language === 'th' ? 'ขาย' : 'SELL')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Indicators */}
        <div className="alert-modal-indicators">
          <div className="ind-item">
            <Activity size={14} />
            <span>RSI</span>
            <span className={group.rsi && group.rsi < 30 ? 'oversold' : group.rsi && group.rsi > 70 ? 'overbought' : ''}>
              {group.rsi?.toFixed(0) || '-'}
            </span>
          </div>
          <div className="ind-item">
            {group.trend === 'bullish' ? <TrendingUp size={14} className="bullish" /> : group.trend === 'bearish' ? <TrendingDown size={14} className="bearish" /> : <Minus size={14} />}
            <span>{language === 'th' ? 'เทรนด์' : 'Trend'}</span>
            <span className={group.trend || ''}>
              {group.trend === 'bullish' ? (language === 'th' ? 'ขึ้น' : 'Up') : group.trend === 'bearish' ? (language === 'th' ? 'ลง' : 'Down') : '-'}
            </span>
          </div>
          <div className="ind-item">
            <Volume2 size={14} />
            <span>Vol</span>
            <span className={group.volumeRatio && group.volumeRatio > 1.5 ? 'high' : ''}>
              {group.volumeRatio ? `${group.volumeRatio.toFixed(1)}x` : '-'}
            </span>
          </div>
        </div>
        
        {/* Reasons */}
        {group.positionScore?.reasons && group.positionScore.reasons.length > 0 && (
          <div className="alert-modal-reasons">
            {group.positionScore.reasons.map((r, i) => (
              <div key={i} className={`reason-row ${r.type.toLowerCase()}`}>
                <span className="reason-dot" />
                {r.message}
              </div>
            ))}
          </div>
        )}
        
        {/* Warning */}
        {group.consensus === 'MIXED' && (
          <div className="alert-modal-warning">
            <AlertTriangle size={14} />
            {language === 'th' ? 'สัญญาณขัดแย้ง - ควรรอความชัดเจน' : 'Conflicting signals - Wait for clarity'}
          </div>
        )}
      </div>
    </div>
  )
  
  return createPortal(modal, document.body)
}

export default function AlertsView() {
  const { watchlist, smcData } = useStore()
  const { t, language } = useTranslation()
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedStock, setSelectedStock] = useState<StockAlertGroup | null>(null)
  const { prices: livePrices } = useLivePrices(watchlist)

  // Build stock groups
  const stockGroups: StockAlertGroup[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (!stock?.alerts?.length) continue
    
    const orderBlocks = stock.order_blocks || []
    const livePrice = livePrices[symbol]?.price
    const priceChange = livePrices[symbol]?.change
    
    const alerts: SingleAlert[] = stock.alerts.map(alert => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchingOB = orderBlocks.find((ob: any) => ob.in_zone || ob.signal === alert.signal)
      return {
        type: alert.type,
        signal: alert.signal,
        priority: alert.priority || 'low',
        distancePct: alert.distance_pct,
        qualityScore: matchingOB?.quality_score || 50,
        volumeConfirmed: matchingOB?.volume?.confirmed === true || String(matchingOB?.volume?.confirmed) === 'True',
        trendAligned: matchingOB?.trend_aligned || false
      }
    }).sort((a, b) => (ALERT_PRIORITY[a.type] || 99) - (ALERT_PRIORITY[b.type] || 99))
    
    const analysis = analyzeAlerts(alerts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionScore = (stock as any).position_score
    
    stockGroups.push({
      symbol,
      alerts,
      currentPrice: livePrice || stock.current_price,
      priceChange,
      rsi: stock.indicators?.rsi?.value,
      trend: typeof stock.trend === 'string' ? stock.trend : stock.trend?.direction,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      volumeRatio: (stock.indicators as any)?.volume?.ratio,
      consensus: analysis.consensus,
      confidence: positionScore?.score || analysis.confidence,
      buySignals: analysis.buySignals,
      sellSignals: analysis.sellSignals,
      primaryAlert: alerts[0],
      positionScore,
      zone: stock.zones?.current_zone
    })
  }

  const filteredGroups = stockGroups.filter(g => {
    if (filter === 'all') return true
    if (filter === 'buy') return g.consensus === 'BUY'
    if (filter === 'sell') return g.consensus === 'SELL'
    if (filter === 'mixed') return g.consensus === 'MIXED'
    return true
  }).sort((a, b) => {
    const aEntry = a.alerts.some(al => al.type.startsWith('ob_entry_'))
    const bEntry = b.alerts.some(al => al.type.startsWith('ob_entry_'))
    if (aEntry && !bEntry) return -1
    if (!aEntry && bEntry) return 1
    return b.confidence - a.confidence
  })

  const buyCount = stockGroups.filter(g => g.consensus === 'BUY').length
  const sellCount = stockGroups.filter(g => g.consensus === 'SELL').length
  const mixedCount = stockGroups.filter(g => g.consensus === 'MIXED').length
  const entryCount = stockGroups.filter(g => g.alerts.some(a => a.type.startsWith('ob_entry_'))).length

  return (
    <main className="alerts-page">
      {/* Header */}
      <div className="alerts-summary-header">
        {entryCount > 0 ? (
          <div className="alerts-highlight">
            <Target size={20} />
            <span>{language === 'th' ? `${entryCount} หุ้นเข้าจุด!` : `${entryCount} Entry Signal${entryCount > 1 ? 's' : ''}!`}</span>
          </div>
        ) : (
          <div className="alerts-highlight muted">
            <Bell size={20} />
            <span>{language === 'th' ? 'ไม่มีสัญญาณเข้าจุด' : 'No Entry Signals'}</span>
          </div>
        )}
        <div className="alerts-counts">
          <span className="count-badge buy"><TrendingUp size={14} /> {buyCount}</span>
          <span className="count-badge sell"><TrendingDown size={14} /> {sellCount}</span>
          {mixedCount > 0 && <span className="count-badge mixed"><AlertTriangle size={14} /> {mixedCount}</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="alerts-filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{t('all')} ({stockGroups.length})</button>
        <button className={`filter-btn buy ${filter === 'buy' ? 'active' : ''}`} onClick={() => setFilter('buy')}>{language === 'th' ? 'ซื้อ' : 'Buy'} ({buyCount})</button>
        <button className={`filter-btn sell ${filter === 'sell' ? 'active' : ''}`} onClick={() => setFilter('sell')}>{language === 'th' ? 'ขาย' : 'Sell'} ({sellCount})</button>
        {mixedCount > 0 && <button className={`filter-btn mixed ${filter === 'mixed' ? 'active' : ''}`} onClick={() => setFilter('mixed')}>{language === 'th' ? 'ขัดแย้ง' : 'Mixed'} ({mixedCount})</button>}
      </div>

      {/* Cards Grid */}
      <div className="alerts-grid">
        {filteredGroups.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><Bell size={28} /></div>
              <h3>{t('no_alerts_yet')}</h3>
              <p>{t('add_stocks_alerts')}</p>
            </div>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const consensusDisplay = getConsensusDisplay(group.consensus, language)
            const ConsensusIcon = consensusDisplay.icon
            const logoUrl = `https://assets.parqet.com/logos/symbol/${group.symbol}?format=png`
            const hasEntry = group.alerts.some(a => a.type.startsWith('ob_entry_'))
            const info = getAlertInfo(group.primaryAlert, language)
            const AlertIcon = info.Icon
            
            return (
              <div 
                key={group.symbol} 
                className={`alert-card-compact ${group.consensus.toLowerCase()} ${hasEntry ? 'entry' : ''}`}
                onClick={() => setSelectedStock(group)}
              >
                <div className="acc-top">
                  <img src={logoUrl} alt={group.symbol} className="acc-logo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div className="acc-info">
                    <div className="acc-symbol">{group.symbol}</div>
                    <span className="acc-tag" style={{ background: consensusDisplay.bgColor, color: consensusDisplay.color }}>
                      <ConsensusIcon size={10} /> {consensusDisplay.label}
                    </span>
                  </div>
                  <div className="acc-right">
                    <div className="acc-score" style={{ color: consensusDisplay.color }}>{group.confidence}%</div>
                    <div className="acc-price">${group.currentPrice ? formatPrice(group.currentPrice) : '...'}</div>
                    {group.priceChange !== undefined && (
                      <div className={`acc-change ${group.priceChange > 0 ? 'up' : group.priceChange < 0 ? 'down' : ''}`}>
                        {group.priceChange > 0 ? '+' : ''}{group.priceChange.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="acc-bottom">
                  <span className="acc-signal" style={{ color: info.color }}>
                    <AlertIcon size={14} /> {info.label}
                  </span>
                  {group.zone && (
                    <span className={`zone-tag ${group.zone}`}>
                      {group.zone === 'discount' ? <DollarSign size={12} /> : <ArrowUpRight size={12} />}
                    </span>
                  )}
                  <span className="acc-tap-hint">
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedStock && (
        <DetailModal group={selectedStock} language={language} onClose={() => setSelectedStock(null)} />
      )}
    </main>
  )
}
