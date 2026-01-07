'use client'

import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function SignalsCard() {
  const { watchlist, smcData } = useStore()
  const { t, language } = useTranslation()

  // Function to translate alert messages
  const translateMessage = (message: string): string => {
    if (language === 'en') return message
    
    // Bullish BOS
    if (message.includes('Bullish BOS: Price broke above')) {
      const price = message.match(/[\d.]+$/)?.[0] || ''
      return `${t('alert_bullish_bos')} ${price}`
    }
    
    // Bearish BOS
    if (message.includes('Bearish BOS: Price broke below')) {
      const price = message.match(/[\d.]+$/)?.[0] || ''
      return `${t('alert_bearish_bos')} ${price}`
    }
    
    // Premium Zone
    if (message.includes('Premium Zone')) {
      return t('alert_premium_zone')
    }
    
    // Discount Zone
    if (message.includes('Discount Zone')) {
      return t('alert_discount_zone')
    }
    
    // FVG BUY
    if (message.includes('FVG BUY at')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `${t('alert_fvg_buy')} $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    // FVG SELL
    if (message.includes('FVG SELL at')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `${t('alert_fvg_sell')} $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    // BUY Zone / SELL Zone
    if (message.includes('BUY Zone')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `โซนซื้อ ที่ $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    if (message.includes('SELL Zone')) {
      const match = message.match(/\$([0-9.]+)\s*\(([0-9.]+)%/)
      if (match) {
        return `โซนขาย ที่ $${match[1]} (${match[2]}% ${t('alert_away')})`
      }
    }
    
    return message
  }

  // Collect all alerts from watchlist stocks
  const alerts: { symbol: string; message: string; signal: string }[] = []
  
  for (const symbol of watchlist) {
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
