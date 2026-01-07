'use client'

import { Target, ArrowUp, ArrowDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { formatPrice } from '@/lib/utils'

export default function PriceTargetCard() {
  const { watchlist, smcData, onDemandSMC } = useStore()
  const { t } = useTranslation()

  // Find nearest targets across all watchlist (pre-calculated + on-demand)
  const targets: Array<{
    symbol: string
    type: 'BUY' | 'SELL'
    price: number
    distance: number
    distancePct: number
  }> = []

  for (const symbol of watchlist) {
    // Check pre-calculated data
    const stock = smcData?.stocks?.[symbol]
    if (stock) {
      if (stock.nearest_buy_zone) {
        targets.push({
          symbol,
          type: 'BUY',
          price: stock.nearest_buy_zone.mid,
          distance: stock.nearest_buy_zone.distance,
          distancePct: stock.nearest_buy_zone.distance_pct
        })
      }
      if (stock.nearest_sell_zone) {
        targets.push({
          symbol,
          type: 'SELL',
          price: stock.nearest_sell_zone.mid,
          distance: stock.nearest_sell_zone.distance,
          distancePct: stock.nearest_sell_zone.distance_pct
        })
      }
    }
    
    // Check on-demand data
    const onDemand = onDemandSMC[symbol]
    if (onDemand && !stock) {
      const currentPrice = onDemand.current_price
      
      // Support as buy zone
      if (onDemand.support && currentPrice) {
        const distance = currentPrice - onDemand.support
        const distancePct = Math.abs((distance / currentPrice) * 100)
        targets.push({
          symbol,
          type: 'BUY',
          price: onDemand.support,
          distance,
          distancePct: Math.round(distancePct * 10) / 10
        })
      }
      
      // Resistance as sell zone
      if (onDemand.resistance && currentPrice) {
        const distance = onDemand.resistance - currentPrice
        const distancePct = Math.abs((distance / currentPrice) * 100)
        targets.push({
          symbol,
          type: 'SELL',
          price: onDemand.resistance,
          distance,
          distancePct: Math.round(distancePct * 10) / 10
        })
      }
    }
  }

  // Sort by distance percentage
  targets.sort((a, b) => a.distancePct - b.distancePct)

  // Take top 4 nearest
  const nearestTargets = targets.slice(0, 4)

  if (nearestTargets.length === 0) {
    return (
      <article className="card">
        <div className="card-title">
          <span><Target size={14} style={{ verticalAlign: 'middle' }} /> {t('nearest_targets')}</span>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          {t('add_stocks_targets')}
        </div>
      </article>
    )
  }

  return (
    <article className="card">
      <div className="card-title">
        <span><Target size={14} style={{ verticalAlign: 'middle' }} /> {t('nearest_targets')}</span>
      </div>
      <div className="price-targets">
        {nearestTargets.map((target, i) => (
          <div key={i} className={`price-target-item ${target.type.toLowerCase()}`}>
            <div className="target-symbol">
              {target.type === 'BUY' ? (
                <ArrowDown size={14} className="target-arrow buy" />
              ) : (
                <ArrowUp size={14} className="target-arrow sell" />
              )}
              <span>{target.symbol}</span>
            </div>
            <div className="target-info">
              <span className="target-price">${formatPrice(target.price)}</span>
              <span className={`target-distance ${target.distancePct <= 3 ? 'near' : ''}`}>
                {target.distancePct}% {t('away')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}
