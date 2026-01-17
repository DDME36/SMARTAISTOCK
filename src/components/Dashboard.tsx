'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react'
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
import QuickSignalBanner from './QuickSignalBanner'

// Floating Refresh Button for Mobile - uses Portal to escape parent transforms
function MobileRefreshButton() {
  const [refreshing, setRefreshing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { showToast } = useStore()
  const { t } = useTranslation()

  useEffect(() => {
    setMounted(true)
    const checkMobile = () => setIsMobile(window.innerWidth <= 600)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    showToast(t('refreshing'))

    // Trigger a page-wide refresh event
    window.dispatchEvent(new CustomEvent('dashboard-refresh'))

    // Wait a bit then stop
    setTimeout(() => {
      setRefreshing(false)
      showToast(t('data_refreshed'))
    }, 1500)
  }, [refreshing, showToast, t])

  // Don't render on server or desktop
  if (!mounted || !isMobile) return null

  // Use portal to render at document.body level - escapes any parent transforms
  return createPortal(
    <button
      className={`mobile-refresh-fab ${refreshing ? 'refreshing' : ''}`}
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh"
    >
      <RefreshCw size={20} className={refreshing ? 'icon-spin' : ''} />
    </button>,
    document.body
  )
}

// Connection Status Component
function ConnectionIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showOffline, setShowOffline] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowOffline(false)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setShowOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showOffline) return null

  return (
    <div className={`connection-indicator ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
    </div>
  )
}

// Data Freshness Status
function SMCUpdateInfo() {
  const { smcData, isLoading } = useStore()
  const { language } = useTranslation()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  if (!smcData?.generated_at) return null

  let generatedAt: Date
  const genAt = smcData.generated_at
  if (genAt.endsWith('Z') || genAt.includes('+') || genAt.includes('-', 10)) {
    generatedAt = new Date(genAt)
  } else {
    generatedAt = new Date(genAt + 'Z')
  }

  const diffMins = Math.round((now.getTime() - generatedAt.getTime()) / 60000)

  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = etNow.getHours()
  const minute = etNow.getMinutes()
  const day = etNow.getDay()
  const timeInMins = hour * 60 + minute
  const marketOpen = 9 * 60 + 30
  const marketClose = 16 * 60
  const isWeekday = day >= 1 && day <= 5
  const isMarketHours = isWeekday && timeInMins >= marketOpen && timeInMins <= marketClose

  const getTimeUntilMarketOpen = () => {
    let daysToAdd = 0
    if (day === 0) daysToAdd = 1
    else if (day === 6) daysToAdd = 2
    else if (timeInMins >= marketClose) daysToAdd = day === 5 ? 3 : 1

    let minsUntilOpen = 0
    if (daysToAdd > 0) {
      minsUntilOpen = daysToAdd * 24 * 60 - timeInMins + marketOpen
    } else if (timeInMins < marketOpen) {
      minsUntilOpen = marketOpen - timeInMins
    }

    if (minsUntilOpen <= 0) return null

    const hours = Math.floor(minsUntilOpen / 60)
    const mins = minsUntilOpen % 60

    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    } else if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const timeStr = generatedAt.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  let diffText = ''
  if (diffMins < 60) diffText = `${diffMins}m`
  else if (diffMins < 1440) diffText = `${Math.round(diffMins / 60)}h`
  else diffText = `${Math.round(diffMins / 1440)}d`

  let nextText = ''
  if (isMarketHours) {
    const minsToNext = 15 - (minute % 15)
    nextText = language === 'th' ? `รอบถัดไป ~${minsToNext}m` : `Next ~${minsToNext}m`
  } else {
    const countdown = getTimeUntilMarketOpen()
    if (countdown) {
      nextText = language === 'th' ? `ตลาดเปิดใน ${countdown}` : `Opens in ${countdown}`
    } else {
      nextText = language === 'th' ? 'ตลาดปิด' : 'Closed'
    }
  }

  // Fresh = < 20 mins, Stale = > 30 mins during market hours
  const isFresh = diffMins < 20
  const isStale = isMarketHours && diffMins > 30

  return (
    <div className={`smc-update-info ${isLoading ? 'loading' : ''}`}>
      <div className="smc-update-time">
        <span className={`smc-update-dot ${isStale ? 'stale' : isFresh ? 'fresh' : ''}`}>
          {isLoading && <RefreshCw size={8} className="icon-spin" />}
        </span>
        <span>
          {language === 'th' ? 'อัพเดท' : 'Updated'}: {timeStr} ({diffText})
        </span>
        <span className="smc-separator">•</span>
        <span className="smc-next-text">
          <Clock size={10} />
          {nextText}
        </span>
        <ConnectionIndicator />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger staggered animation after mount
    setMounted(true)
  }, [])

  return (
    <main>
      <NotificationBanner />
      <QuickSignalBanner />
      <div className={`bento-grid ${mounted ? 'animate-in' : ''}`}>
        <SentimentCard />
        <AddSymbolCard />
        <MarketStatusCard />
        <QuickStatsCard />
        <WatchlistCard />
        <PriceTargetCard />
        <SignalsCard />
      </div>
      <SMCUpdateInfo />
      <MobileRefreshButton />
    </main>
  )
}
