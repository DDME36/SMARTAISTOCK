'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import NotificationBanner from './NotificationBanner'
import SentimentCard from './cards/SentimentCard'
import AddSymbolCard from './cards/AddSymbolCard'
import MarketStatusCard from './cards/MarketStatusCard'
import WatchlistCard from './cards/WatchlistCard'
import SignalsCard from './cards/SignalsCard'
import QuickStatsCard from './cards/QuickStatsCard'
import PriceTargetCard from './cards/PriceTargetCard'

function SMCUpdateInfo() {
  const { smcData } = useStore()
  const { language } = useTranslation()
  const [now, setNow] = useState(new Date())
  
  // Update every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  
  if (!smcData?.generated_at) return null
  
  const generatedAt = new Date(smcData.generated_at)
  const diffMins = Math.round((now.getTime() - generatedAt.getTime()) / 60000)
  
  // Check if market is open (9:30 AM - 4:00 PM ET, Mon-Fri)
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = etNow.getHours()
  const minute = etNow.getMinutes()
  const day = etNow.getDay()
  const timeInMins = hour * 60 + minute
  const marketOpen = 9 * 60 + 30  // 9:30 AM ET
  const marketClose = 16 * 60     // 4:00 PM ET
  const isWeekday = day >= 1 && day <= 5
  const isMarketHours = isWeekday && timeInMins >= marketOpen && timeInMins <= marketClose
  
  // Calculate time until market opens
  const getTimeUntilMarketOpen = () => {
    let daysToAdd = 0
    
    // If weekend, find next Monday
    if (day === 0) { // Sunday
      daysToAdd = 1
    } else if (day === 6) { // Saturday
      daysToAdd = 2
    } else if (timeInMins >= marketClose) {
      // After market close, next day (or Monday if Friday)
      daysToAdd = day === 5 ? 3 : 1
    }
    
    // Calculate minutes until 9:30 AM ET
    let minsUntilOpen = 0
    if (daysToAdd > 0) {
      // Full days + time until 9:30 AM
      minsUntilOpen = daysToAdd * 24 * 60 - timeInMins + marketOpen
    } else if (timeInMins < marketOpen) {
      // Same day, before market open
      minsUntilOpen = marketOpen - timeInMins
    }
    
    if (minsUntilOpen <= 0) return null
    
    const hours = Math.floor(minsUntilOpen / 60)
    const mins = minsUntilOpen % 60
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return language === 'th' 
        ? `${days}d ${remainingHours}h` 
        : `${days}d ${remainingHours}h`
    } else if (hours > 0) {
      return `${hours}h ${mins}m`
    } else {
      return `${mins}m`
    }
  }
  
  // Format last update time - convert to local timezone
  const timeStr = generatedAt.toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
  
  // Format diff
  let diffText = ''
  if (diffMins < 60) {
    diffText = `${diffMins}m`
  } else if (diffMins < 1440) {
    diffText = `${Math.round(diffMins / 60)}h`
  } else {
    diffText = `${Math.round(diffMins / 1440)}d`
  }
  
  // Next update text
  let nextText = ''
  if (isMarketHours) {
    const minsToNext = 15 - (minute % 15)
    nextText = language === 'th' ? `รอบถัดไป ~${minsToNext}m` : `Next ~${minsToNext}m`
  } else {
    const countdown = getTimeUntilMarketOpen()
    if (countdown) {
      nextText = language === 'th' ? `ตลาดเปิดใน ${countdown}` : `Market opens in ${countdown}`
    } else {
      nextText = language === 'th' ? 'ตลาดปิด' : 'Market closed'
    }
  }
  
  // Data is stale if > 30 mins during market hours
  const isStale = isMarketHours && diffMins > 30
  
  return (
    <div className="smc-update-info">
      <div className="smc-update-time">
        <span className={`smc-update-dot ${isStale ? 'stale' : ''}`}></span>
        <span>
          {language === 'th' ? 'อัพเดท' : 'Updated'}: {timeStr} ({diffText})
        </span>
        <span className="smc-separator">•</span>
        <span className="smc-next-text">
          <Clock size={10} />
          {nextText}
        </span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <main>
      <NotificationBanner />
      <div className="bento-grid">
        <SentimentCard />
        <AddSymbolCard />
        <MarketStatusCard />
        <QuickStatsCard />
        <WatchlistCard />
        <PriceTargetCard />
        <SignalsCard />
      </div>
      <SMCUpdateInfo />
    </main>
  )
}
