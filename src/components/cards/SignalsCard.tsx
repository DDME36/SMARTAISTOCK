'use client'

import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

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
}

export default function SignalsCard() {
  const { watchlist, smcData, onDemandSMC } = useStore()
  const { t, language } = useTranslation()

  // Function to translate alert messages based on language setting
  const translateMessage = (alert: Alert): string => {
    const message = alert.message
    const type = alert.type || ''
    
    // If language is Thai, keep Thai messages or translate English to Thai
    if (language === 'th') {
      // Already Thai
      if (message.includes('ราคาเข้าโซน') || message.includes('ใกล้โซน') || message.includes('สัญญาณ')) {
        return message
      }
      
      // Translate English to Thai
      if (type.startsWith('ob_entry_')) {
        const signal = alert.signal === 'BUY' ? 'ซื้อ' : 'ขาย'
        return `🎯 ราคาเข้าโซน ${alert.signal} Order Block! - สัญญาณ${signal}`
      }
      if (type.startsWith('ob_near_')) {
        return `⚠️ ใกล้โซน ${alert.signal} ที่ $${alert.level?.toFixed(2) || ''} (${alert.distance_pct?.toFixed(1) || ''}% away)`
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
      
      return message
    }
    
    // If language is English, translate Thai to English
    if (language === 'en') {
      // OB Entry alerts (Thai -> English)
      if (message.includes('ราคาเข้าโซน') && message.includes('Order Block')) {
        const signal = alert.signal === 'BUY' ? 'Buy' : 'Sell'
        return `🎯 Price entered ${alert.signal} Order Block! - ${signal} signal`
      }
      
      // Near OB alerts
      if (message.includes('ใกล้โซน')) {
        return `⚠️ Near ${alert.signal} Zone at $${alert.level?.toFixed(2) || ''} (${alert.distance_pct?.toFixed(1) || ''}% away)`
      }
      
      // Already English
      if (message.includes('CHoCH') || message.includes('BOS') || message.includes('FVG')) {
        return message
      }
      if (message.includes('Zone') || message.includes('Order Block')) {
        return message
      }
      
      // Type-based translation
      if (type.startsWith('ob_entry_')) {
        const signal = alert.signal === 'BUY' ? 'Buy' : 'Sell'
        return `🎯 Price entered ${alert.signal} Order Block! - ${signal} signal`
      }
      if (type.startsWith('ob_near_')) {
        return `⚠️ Near ${alert.signal} Zone at $${alert.level?.toFixed(2) || ''} (${alert.distance_pct?.toFixed(1) || ''}% away)`
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
      
      // Generic Thai to English
      if (message.includes('สัญญาณซื้อ')) return message.replace('สัญญาณซื้อ', 'Buy signal')
      if (message.includes('สัญญาณขาย')) return message.replace('สัญญาณขาย', 'Sell signal')
      
      return message
    }
    
    return message
  }

  // Check if alert is critical (OB entry)
  const isCriticalAlert = (alert: Alert): boolean => {
    return alert.type?.startsWith('ob_entry_') || 
           alert.priority === 'critical' ||
           alert.message?.includes('ราคาเข้าโซน') ||
           alert.message?.includes('Price entered')
  }

  // Collect all alerts from watchlist stocks
  const alerts: Alert[] = []
  
  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (stock?.alerts?.length) {
      for (const alert of stock.alerts) {
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.signal,
          type: alert.type,
          priority: alert.priority,
          level: alert.level,
          distance_pct: alert.distance_pct,
          ob_high: alert.ob_high,
          ob_low: alert.ob_low
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

  // Sort: critical alerts first
  alerts.sort((a, b) => {
    if (isCriticalAlert(a) && !isCriticalAlert(b)) return -1
    if (!isCriticalAlert(a) && isCriticalAlert(b)) return 1
    return 0
  })

  return (
    <article className="card">
      <div className="card-title">{t('recent_signals')}</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 12 }}>
            {t('no_signals')}
          </div>
        ) : (
          alerts.slice(0, 6).map((alert, i) => {
            const isCritical = isCriticalAlert(alert)
            const isSell = alert.signal === 'SELL'
            const translatedMessage = translateMessage(alert)
            
            if (isCritical) {
              return (
                <div key={i} className={`ob-entry-alert ${isSell ? 'sell' : ''}`}>
                  <span className="ob-entry-icon">{isSell ? '🔴' : '🟢'}</span>
                  <div className="ob-entry-text">
                    <div className="ob-entry-title">{alert.symbol}</div>
                    <div className="ob-entry-subtitle">{translatedMessage}</div>
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
          })
        )}
      </div>
    </article>
  )
}
