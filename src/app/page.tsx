'use client'

import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useAuthStore } from '@/store/useAuthStore'
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
import AuthScreen from '@/components/AuthScreen'

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
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()
  const notifiedAlertsRef = useRef<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    // Set theme based on time
    const currentTheme = getThemeByTime()
    setTheme(currentTheme)
    document.body.className = currentTheme
    
    // Register Service Worker for PWA (skip on Safari to avoid issues)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (!isSafari) {
      registerServiceWorker()
    }
    
    // Fetch SMC data - try API first (gets latest from GitHub), fallback to static
    const fetchData = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        
        // Try API endpoint first (fetches from GitHub raw)
        let res = await fetch('/api/smc-data', {
          signal: controller.signal,
          cache: 'no-store'
        })
        
        // Fallback to static file if API fails
        if (!res.ok) {
          res = await fetch('/data/smc_data.json?t=' + Date.now(), {
            signal: controller.signal,
            cache: 'no-store'
          })
        }
        
        clearTimeout(timeoutId)
        
        if (res.ok) {
          const data = await res.json()
          setSmcData(data)
        }
      } catch (e) {
        console.log('SMC data fetch error:', e)
        // Try static file as last resort
        try {
          const res = await fetch('/data/smc_data.json')
          if (res.ok) {
            const data = await res.json()
            setSmcData(data)
          }
        } catch {}
      } finally {
        setIsLoading(false)
      }
    }
    
    // Set max loading time
    const maxLoadTimer = setTimeout(() => setIsLoading(false), 3000)
    
    fetchData()
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchData, 120000)
    
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
  if (authLoading || isLoading) {
    return <LoadingScreen />
  }

  // Show auth screen if not logged in
  if (!isAuthenticated) {
    return <AuthScreen />
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
