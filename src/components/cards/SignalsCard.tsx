'use client'

import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function SignalsCard() {
  const { watchlist, smcData, onDemandSMC } = useStore()
  const { t, language } = useTranslation()

  // Function to translate alert messages
  const translateMessage = (message: string): string => {
    if (language === 'en') return message
    
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
        return `FVG ${type} ที่ $${match[1]} (ห่าง ${match[2]}%)`
      }
    }
    
    // Zone alerts
    if (message.includes('Discount Zone')) {
      return 'ราคาอยู่ในโซน Discount - มองหาจุดซื้อ'
    }
    if (message.includes('Premium Zone')) {
      return 'ราคาอยู่ในโซน Premium - มองหาจุดขาย'
    }
    
    // Order Block entries
    if (message.includes('Bullish OB')) {
      return 'ราคาเข้าโซน Bullish OB'
    }
    if (message.includes('Bearish OB')) {
      return 'ราคาเข้าโซน Bearish OB'
    }
    
    // Approaching
    if (message.includes('Approaching')) {
      if (message.includes('bullish')) return 'ใกล้ถึงโซน Bullish OB'
      if (message.includes('bearish')) return 'ใกล้ถึงโซน Bearish OB'
    }
    
    // Liquidity
    if (message.includes('Equal Highs')) {
      const match = message.match(/\$([\d.]+)/)
      if (match) return `Equal Highs ที่ $${match[1]} - สภาพคล่องด้านบน`
    }
    if (message.includes('Equal Lows')) {
      const match = message.match(/\$([\d.]+)/)
      if (match) return `Equal Lows ที่ $${match[1]} - สภาพคล่องด้านล่าง`
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

  // Collect all alerts from watchlist stocks (pre-calculated + on-demand)
  const alerts: { symbol: string; message: string; signal: string }[] = []
  
  for (const symbol of watchlist) {
    // Check pre-calculated data first
    const stock = smcData?.stocks?.[symbol]
    if (stock?.alerts?.length) {
      for (const alert of stock.alerts) {
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.signal
        })
      }
    }
    
    // Check on-demand data
    const onDemand = onDemandSMC[symbol]
    if (onDemand?.alerts?.length) {
      for (const alert of onDemand.alerts) {
        alerts.push({
          symbol,
          message: alert.message,
          signal: alert.type === 'entry' ? 'BUY' : 'INFO'
        })
      }
    }
  }

  return (
    <article className="card">
      <div className="card-title">{t('recent_signals')}</div>
      
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alerts.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', opacity: 0.5 }}>
            {t('no_signals')}
          </div>
        ) : (
          alerts.slice(0, 5).map((alert, i) => (
            <div key={i} style={{ padding: 8, borderBottom: '1px solid var(--glass-border)' }}>
              <span className={`badge ${alert.signal === 'BUY' ? 'badge-bull' : 'badge-bear'}`}>
                {alert.symbol}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                {translateMessage(alert.message)}
              </span>
            </div>
          ))
        )}
      </div>
    </article>
  )
}
