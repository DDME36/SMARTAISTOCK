'use client'

import { RefreshCw, Bell } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function Header() {
  const { setSmcData, showToast } = useStore()
  const { t } = useTranslation()

  const handleRefresh = async () => {
    showToast(t('refreshing'))
    try {
      const res = await fetch('/data/smc_data.json?t=' + Date.now())
      if (res.ok) {
        const data = await res.json()
        setSmcData(data)
        showToast(t('updated'))
      }
    } catch {
      showToast(t('error_refresh'))
    }
  }

  const handleNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(p => {
        if (p === 'granted') showToast(t('notifications_enabled'))
      })
    }
  }

  return (
    <header className="app-header">
      <div className="brand">
        <h1>BlockHunter</h1>
        <span>{t('pro_terminal')}</span>
      </div>
      <div className="header-controls">
        <button className="btn" onClick={handleRefresh}>
          <RefreshCw size={16} /> {t('refresh')}
        </button>
        <button className="btn btn-primary" onClick={handleNotifications}>
          <Bell size={16} /> {t('alerts')}
        </button>
      </div>
    </header>
  )
}
