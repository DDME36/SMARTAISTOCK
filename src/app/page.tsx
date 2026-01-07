'use client'

import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { getThemeByTime } from '@/lib/utils'
import { registerServiceWorker, checkAndNotifyAlerts } from '@/lib/notifications'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import WatchlistView from '@/components/WatchlistView'
import AlertsView from '@/components/AlertsView'
import SettingsView from '@/components/SettingsView'
import BottomNav from '@/components/BottomNav'
import Toast from '@/components/Toast'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import ConnectionStatus from '@/components/ConnectionStatus'
import LoadingScreen from '@/components/LoadingScreen'
import NoDataBanner from '@/components/NoDataBanner'

// Page transition wrapper component
function PageTransition({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [viewKey])
  
  return (
    <div className={`page-transition ${isVisible ? 'visible' : ''}`}>
      {children}
    </div>
  )
}

export default function Home() {
  const { activeView, theme, setTheme, setSmcData, watchlist, smcData, language } = useStore()
  const notifiedAlertsRef = useRef<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Set theme based on time
    const currentTheme = getThemeByTime()
    setTheme(currentTheme)
    document.body.className = currentTheme
    
    // Register Service Worker for PWA
    registerServiceWorker()
    
    // Fetch SMC data with timeout
    const fetchData = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
        
        const res = await fetch('/data/smc_data.json?t=' + Date.now(), {
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        
        if (res.ok) {
          const data = await res.json()
          setSmcData(data)
        }
      } catch (e) {
        console.log('SMC data not available (this is normal if backend not run yet)')
      } finally {
        // Always stop loading after 2 seconds max
        setIsLoading(false)
      }
    }
    
    // Set max loading time
    const maxLoadTimer = setTimeout(() => setIsLoading(false), 2000)
    
    fetchData()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 300000)
    
    // Update theme every hour
    const themeInterval = setInterval(() => {
      const newTheme = getThemeByTime()
      setTheme(newTheme)
      document.body.className = newTheme
    }, 3600000)
    
    return () => {
      clearTimeout(maxLoadTimer)
      clearInterval(interval)
      clearInterval(themeInterval)
    }
  }, []) // Empty deps - run once on mount

  // Update body class when theme or language changes
  useEffect(() => {
    document.body.className = `${theme} lang-${language}`
    document.documentElement.lang = language
  }, [theme, language])

  // Check for alerts and notify
  useEffect(() => {
    if (!smcData || watchlist.length === 0) return

    const checkAlerts = async () => {
      notifiedAlertsRef.current = await checkAndNotifyAlerts(
        watchlist,
        smcData,
        notifiedAlertsRef.current
      )
    }

    checkAlerts()
  }, [smcData, watchlist])

  // Show loading screen on first load
  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <>
      <ConnectionStatus />
      
      <div className="app-wrapper">
        <Header />
        
        <NoDataBanner />
        
        <PageTransition viewKey={activeView}>
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'watchlist' && <WatchlistView />}
          {activeView === 'alerts' && <AlertsView />}
          {activeView === 'settings' && <SettingsView />}
        </PageTransition>
      </div>
      
      <BottomNav />
      <Toast />
      <PWAInstallBanner />
    </>
  )
}
