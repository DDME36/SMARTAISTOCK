'use client'

import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function QuickStatsCard() {
  const { watchlist, smcData } = useStore()
  const { t } = useTranslation()

  // Calculate stats
  let totalBuyZones = 0
  let totalSellZones = 0
  let nearAlerts = 0
  let bullishCount = 0

  // Helper to get trend direction
  const getTrendDirection = (trend: string | { direction: string } | undefined): string => {
    if (!trend) return 'neutral'
    if (typeof trend === 'string') return trend
    return trend.direction || 'neutral'
  }

  for (const symbol of watchlist) {
    const stock = smcData?.stocks?.[symbol]
    if (!stock) continue

    totalBuyZones += stock.ob_summary?.total_buy || 0
    totalSellZones += stock.ob_summary?.total_sell || 0
    nearAlerts += stock.alerts?.length || 0

    if (getTrendDirection(stock.trend) === 'bullish') bullishCount++
  }

  const stats = [
    {
      icon: TrendingUp,
      label: t('buy'),
      value: totalBuyZones,
      color: 'var(--accent-success)'
    },
    {
      icon: TrendingDown,
      label: t('sell'),
      value: totalSellZones,
      color: 'var(--accent-danger)'
    },
    {
      icon: Target,
      label: t('near'),
      value: nearAlerts,
      color: 'var(--accent-warning)'
    },
    {
      icon: Activity,
      label: t('bull'),
      value: `${bullishCount}/${watchlist.length || 0}`,
      color: 'var(--accent-primary)'
    }
  ]

  if (watchlist.length === 0) {
    return (
      <article className="card quick-stats-empty">
        <Activity size={24} style={{ color: 'var(--text-tertiary)' }} />
        <p>{t('add_stocks_stats')}</p>
      </article>
    )
  }

  return (
    <article className="card quick-stats col-span-3">
      {stats.map((stat, i) => (
        <div key={i} className="quick-stat-item">
          <stat.icon size={16} style={{ color: stat.color }} />
          <span className="quick-stat-value" style={{ color: stat.color }}>{stat.value}</span>
          <span className="quick-stat-label">{stat.label}</span>
        </div>
      ))}
    </article>
  )
}
