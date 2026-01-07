'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function ConnectionStatus() {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(true)
  const [showStatus, setShowStatus] = useState(false)

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowStatus(true)
      // Hide after 3 seconds
      setTimeout(() => setShowStatus(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowStatus(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!showStatus && isOnline) return null

  return (
    <div className={`connection-status ${isOnline ? 'online' : ''}`}>
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>{t('back_online')}</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>{t('no_connection')}</span>
        </>
      )}
    </div>
  )
}
