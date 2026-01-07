'use client'

import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function SignalsCard() {
  const { watchlist, smcData, onDemandSMC } = useStore()
  const { t, language } = useTranslation()

  // Function to translate alert messages
  const translateMessage = (message: string): string => {
    if (language === 'en') return message
    
    // Order Block entries
    if (message.includes('Discount Zone') || message.includes('Bullish OB')) {
      return 'ราคาเข้าโซน Discount (Bullish OB)'
    }
    if (message.includes('Premium Zone') || message.includes('Bearish OB')) {
      return 'ราคาเข้าโซน Premium (Bearish OB)'
    }
    
    // BOS
    if (message.includes('Bullish BOS') || message.toLowerCase().includes('bullish bos')) {
      return 'ยืนยัน Bullish BOS'
    }
    if (message.includes('Bearish BOS') || message.toLowerCase().includes('bearish bos')) {
      return 'ยืนยัน Bearish BOS'
    }
    
    // Approaching
    if (message.includes('Approaching')) {
      if (message.includes('bullish')) return 'ใกล้ถึงโซน Bullish OB'
      if (message.includes('bearish')) return 'ใกล้ถึงโซน Bearish OB'
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
