'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { isMarketOpen, getETTime, isDataStale } from '@/lib/utils'

export default function MarketStatusCard() {
  const { smcData } = useStore()
  const { t } = useTranslation()
  
  const [time, setTime] = useState(getETTime())
  const [marketOpen, setMarketOpen] = useState(isMarketOpen())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getETTime())
      setMarketOpen(isMarketOpen())
    }, 60000)
    return () => clearInterval(interval)
  }, [])
  
  const { stale, minutesAgo } = isDataStale(smcData?.generated_at)
  
  let dotColor = 'var(--text-tertiary)'
  let statusText = t('market_closed')
  let statusColor = 'var(--text-secondary)'
  let timeText = `${time} ET`
  
  if (stale) {
    dotColor = 'var(--accent-warning)'
    statusText = t('data_delayed')
    statusColor = 'var(--accent-warning)'
    timeText = `Last update: ${minutesAgo}m ago`
  } else if (marketOpen) {
    dotColor = 'var(--accent-success)'
    statusText = t('market_open')
    statusColor = 'var(--accent-success)'
  }

  return (
    <article className="card" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div 
        style={{ 
          width: 12, 
          height: 12, 
          background: dotColor, 
          borderRadius: '50%', 
          marginBottom: 12,
          boxShadow: marketOpen || stale ? `0 0 10px ${dotColor}` : 'none'
        }} 
      />
      <div style={{ fontWeight: 600, fontSize: 16, color: statusColor }}>{statusText}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{timeText}</div>
    </article>
  )
}
