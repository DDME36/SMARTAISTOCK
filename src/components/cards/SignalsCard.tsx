'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { BarChart3, TrendingUp as TrendIcon, ChevronDown } from 'lucide-react'

interface Alert {
  symbol: string
  message: string
  signal: string
  type?: string
  priority?: string
  ob_high?: number
  ob_low?: number
  level?: number
  distance_pct?: number
  // Quality data
  qualityScore?: number
  volumeConfirmed?: boolean
  trendAligned?: boolean
}

// Get quality info
const getQualityInfo = (score: number, language: string) => {
  if (score >= 80) return { label: language === 'th' ? 'แข็งแกร่ง' : 'Strong', color: '#10b981', stars: 3 }
  if (score >= 60) return { label: language === 'th' ? 'ดี' : 'Good', color: '#3b82f6', stars: 2 }
  if (score >= 40) return { label: language === 'th' ? 'ปานกลาง' : 'Moderate', color: '#f59e0b', stars: 1 }
  return { label: language === 'th' ? 'อ่อน' : 'Weak', color: '#6b7280', stars: 0 }
}

export default function SignalsCard() {
  const { watchlist, smcData, onDemandSMC } = useStore()
  const { t, language } = useTranslation()
  const [isMobile, setIsMobile] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 600)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Translate alert messages
  const translateMessage = (alert: Alert): string => {
    const type = alert.type || ''
    
    if (language === 'th') {
      if (type.startsWith('ob_entry_')) return `ราคาเข้าโซน Order Block`
      if (type.startsWith('ob_near_')) return `ใกล้โซน ${alert.signal} (${alert.distance_pct?.toFixed(1)}%)`
      if (type.includes('choch')) return type.includes('bullish') ? 'CHoCH: อาจกลับตัวขึ้น' : 'CHoCH: อาจกลับตัวลง'
      if (type.includes('bos')) return type.includes('bullish') ? 'BOS: ทะลุแนวต้าน' : 'BOS: ทะลุแนวรับ'
      if (type.includes('fvg')) return `FVG ${alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'}`
      if (type === 'zone_premium') return 'อยู่ในโซน Premium'
      if (type === 'zone_discount') return 'อยู่ในโซน Discount'
    }
    
    // English
    if (type.startsWith('ob_entry_')) return `Price entered Order Block`
    if (type.startsWith('ob_near_')) return `Near ${alert.signal} Zone (${alert.distance_pct?.toFixed(1)}%)`
    if (type.includes('choch')) return type.includes('bullish') ? 'CHoCH: Reversal up' : 'CHoCH: Reversal down'
    if (type.includes('bos')) return type.includes('bullish') ? 'BOS: Broke resistance' : 'BOS: Broke support'
    if (type.includes('fvg')) return `FVG ${alert.signal}`
    if (type === 'zone_premium') return 'In Premium Zone'
    if (type === 'zone_discount') return 'In Discount Zone'
    
    return alert.message
  }

  // Check if alert is critical (OB entry)
  const isCriticalAlert = (alert: Alert): boolean => {
    return alert.type?.startsWith('ob_entry_') || alert.priority === 'critical'
  }

  // Collect all alerts with quality data
  const alerts: Alert[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (stock?.alerts?.length) {
      const orderBlocks = stock.order_blocks || []
      
      // Check if this symbol has an OB entry alert (highest priority)
      const hasOBEntry = stock.alerts.some((a: { type?: string }) => a.type?.startsWith('ob_entry_'))
      
      for (const alert of stock.alerts) {
        // Skip zone alerts if we already have OB entry for this symbol
        if (hasOBEntry && (alert.type === 'zone_premium' || alert.type === 'zone_discount')) {
          continue
        }
        
        let qualityScore = 50
        let volumeConfirmed = false
        let trendAligned = false
        
        if (alert.type?.includes('ob_')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchingOB = orderBlocks.find((ob: any) => ob.in_zone || ob.signal === alert.signal)
          if (matchingOB) {
            qualityScore = matchingOB.quality_score || 50
            volumeConfirmed = matchingOB.volume?.confirmed || false
            trendAligned = matchingOB.trend_aligned || false
          }
        }
        
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.signal,
          type: alert.type,
          priority: alert.priority,
          level: alert.level,
          distance_pct: alert.distance_pct,
          ob_high: alert.ob_high,
          ob_low: alert.ob_low,
          qualityScore,
          volumeConfirmed,
          trendAligned
        })
      }
    }
    
    const onDemand = onDemandSMC[symbol]
    if (onDemand?.alerts?.length) {
      for (const alert of onDemand.alerts) {
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.type === 'entry' ? 'BUY' : 'INFO',
          type: alert.type
        })
      }
    }
  }

  // Sort: critical first, then by quality
  alerts.sort((a, b) => {
    if (isCriticalAlert(a) && !isCriticalAlert(b)) return -1
    if (!isCriticalAlert(a) && isCriticalAlert(b)) return 1
    if (isCriticalAlert(a) && isCriticalAlert(b)) {
      return (b.qualityScore || 0) - (a.qualityScore || 0)
    }
    return 0
  })

  const isOBAlert = (type?: string) => type?.includes('ob_entry_') || type?.includes('ob_near_')

  // Mobile: show 3 initially, all when expanded
  // Desktop: always show up to 6
  const initialMobileCount = 3
  const desktopCount = 6
  
  // Calculate display count
  const displayCount = isMobile 
    ? (showAll ? alerts.length : initialMobileCount)
    : desktopCount
  
  // Has more only on mobile when not showing all
  const remainingCount = alerts.length - initialMobileCount
  const hasMore = isMobile && !showAll && remainingCount > 0

  return (
    <article className="card">
      <div className="card-title">{t('recent_signals')}</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 12 }}>
            {t('no_signals')}
          </div>
        ) : (
          <>
            {alerts.slice(0, displayCount).map((alert, i) => {
              const isCritical = isCriticalAlert(alert)
              const isSell = alert.signal === 'SELL'
              const translatedMessage = translateMessage(alert)
              const isOB = isOBAlert(alert.type)
              const qualityInfo = isOB ? getQualityInfo(alert.qualityScore || 50, language) : null
              
              if (isCritical) {
                return (
                  <div key={i} className={`ob-entry-alert ${isSell ? 'sell' : ''}`}>
                    <span className="ob-entry-icon">{isSell ? '🔴' : '🟢'}</span>
                    <div className="ob-entry-text">
                      <div className="ob-entry-title">
                        {alert.symbol}
                        {qualityInfo && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: qualityInfo.color }}>
                            {'★'.repeat(qualityInfo.stars)}{'☆'.repeat(3 - qualityInfo.stars)}
                          </span>
                        )}
                      </div>
                      <div className="ob-entry-subtitle">
                        {translatedMessage}
                        {isOB && (
                          <span className="signal-quality-badges">
                            {alert.volumeConfirmed && <span className="sq-badge"><BarChart3 size={8} /></span>}
                            {alert.trendAligned && <span className="sq-badge"><TrendIcon size={8} /></span>}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`signal-badge-critical ${isSell ? 'sell' : ''}`}>
                      {isSell ? t('sell') : t('buy')}
                    </span>
                  </div>
                )
              }
              
              return (
                <div key={i} style={{ padding: 8, borderBottom: '1px solid var(--glass-border)' }}>
                  <span className={`badge ${alert.signal === 'BUY' ? 'badge-bull' : 'badge-bear'}`}>
                    {alert.symbol}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {translatedMessage}
                  </span>
                </div>
              )
            })}
            
            {/* Show more button on mobile */}
            {isMobile && hasMore && (
              <button 
                className="show-more-btn"
                onClick={() => setShowAll(!showAll)}
              >
                {language === 'th' ? `ดูเพิ่มอีก ${remainingCount}` : `Show ${remainingCount} more`}
                <ChevronDown size={14} />
              </button>
            )}
            
            {/* Show less button when expanded */}
            {isMobile && showAll && alerts.length > initialMobileCount && (
              <button 
                className="show-more-btn"
                onClick={() => setShowAll(false)}
              >
                {language === 'th' ? 'แสดงน้อยลง' : 'Show less'}
                <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}
