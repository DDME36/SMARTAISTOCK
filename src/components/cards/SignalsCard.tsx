'use client'

import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

interface Alert {
  symbol: string
  message: string
  signal: string
  type?: string
  priority?: string
}

export default function SignalsCard() {
  const { watchlist, smcData, onDemandSMC } = useStore()
  const { t, language } = useTranslation()

  // Function to translate alert messages
  const translateMessage = (message: string): string => {
    if (language === 'en') return message
    
    // Order Block Entry (highest priority)
    if (message.includes('ราคาเข้าโซน') && message.includes('Order Block')) {
      return message // Already in Thai
    }
    
    // CHoCH (Change of Character)
    if (message.includes('Bullish CHoCH')) {
      return 'Bullish CHoCH: อาจกลับตัวเป็นขาขึ้น'
    }
    if (message.includes('Bearish CHoCH')) {
      return 'Bearish CHoCH: อาจกลับตัวเป็นขาลง'
    }
    
    // BOS (Break of Structure)
    if (message.includes('Bullish BOS')) {
      const match = message.match(/above ([\d.]+)/)
      if (match) return `Bullish BOS: ราคาทะลุขึ้นเหนือ ${match[1]}`
      return 'Bullish BOS: ยืนยันแนวโน้มขาขึ้น'
    }
    if (message.includes('Bearish BOS')) {
      const match = message.match(/below ([\d.]+)/)
      if (match) return `Bearish BOS: ราคาทะลุลงต่ำกว่า ${match[1]}`
      return 'Bearish BOS: ยืนยันแนวโน้มขาลง'
    }
    
    // FVG (Fair Value Gap)
    if (message.includes('FVG BUY') || message.includes('FVG SELL')) {
      const match = message.match(/\$([\d.]+).*\(([\d.]+)% away\)/)
      if (match) {
        const type = message.includes('BUY') ? 'ซื้อ' : 'ขาย'
        return `FVG ${type} ที่ ${match[1]} (ห่าง ${match[2]}%)`
      }
    }
    
    // Zone alerts
    if (message.includes('Discount Zone')) {
      return 'ราคาอยู่ในโซน Discount - มองหาจุดซื้อ'
    }
    if (message.includes('Premium Zone')) {
      return 'ราคาอยู่ในโซน Premium - มองหาจุดขาย'
    }
    
    // Near Order Block
    if (message.includes('ใกล้โซน')) {
      return message // Already in Thai
    }
    
    // Order Block entries
    if (message.includes('Bullish OB')) {
      return 'ราคาเข้าโซน Bullish OB - สัญญาณซื้อ'
    }
    if (message.includes('Bearish OB')) {
      return 'ราคาเข้าโซน Bearish OB - สัญญาณขาย'
    }
    
    // BUY/SELL Zone
    if (message.includes('BUY Zone')) {
      const match = message.match(/\$([\d.]+).*\(([\d.]+)% away\)/)
      if (match) return `โซนซื้อ ที่ $${match[1]} (ห่าง ${match[2]}%)`
    }
    if (message.includes('SELL Zone')) {
      const match = message.match(/\$([\d.]+).*\(([\d.]+)% away\)/)
      if (match) return `โซนขาย ที่ $${match[1]} (ห่าง ${match[2]}%)`
    }
    
    // Approaching
    if (message.includes('Approaching')) {
      if (message.includes('bullish')) return 'ใกล้ถึงโซน Bullish OB'
      if (message.includes('bearish')) return 'ใกล้ถึงโซน Bearish OB'
    }
    
    // Liquidity
    if (message.includes('Equal Highs')) {
      const match = message.match(/\$([\d.]+)/)
      if (match) return `Equal Highs ที่ ${match[1]} - สภาพคล่องด้านบน`
    }
    if (message.includes('Equal Lows')) {
      const match = message.match(/\$([\d.]+)/)
      if (match) return `Equal Lows ที่ ${match[1]} - สภาพคล่องด้านล่าง`
    }
    
    // RSI
    if (message.includes('OVERSOLD')) {
      return 'RSI Oversold - อาจเด้งกลับ'
    }
    if (message.includes('OVERBOUGHT')) {
      return 'RSI Overbought - อาจปรับฐาน'
    }
    
    return message
  }

  // Check if alert is critical (OB entry)
  const isCriticalAlert = (alert: Alert): boolean => {
    return alert.type?.startsWith('ob_entry_') || 
           alert.priority === 'critical' ||
           alert.message?.includes('ราคาเข้าโซน')
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
          priority: alert.priority
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
            
            if (isCritical) {
              return (
                <div key={i} className={`ob-entry-alert ${isSell ? 'sell' : ''}`}>
                  <span className="ob-entry-icon">{isSell ? '🔴' : '🟢'}</span>
                  <div className="ob-entry-text">
                    <div className="ob-entry-title">{alert.symbol}</div>
                    <div className="ob-entry-subtitle">{translateMessage(alert.message)}</div>
                  </div>
                  <span className={`signal-badge-critical ${isSell ? 'sell' : ''}`}>
                    {isSell ? 'SELL' : 'BUY'}
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
                  {translateMessage(alert.message)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </article>
  )
}
