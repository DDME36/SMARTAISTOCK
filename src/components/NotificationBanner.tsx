'use client'

import { useState, useEffect } from 'react'
import { Bell, ChevronRight } from 'lucide-react'
import { requestNotificationPermission } from '@/lib/notifications'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function NotificationBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const { showToast } = useStore()
  const { t } = useTranslation()

  useEffect(() => {
    if (!('Notification' in window)) return
    
    setPermission(Notification.permission)
    
    // Show banner if permission not yet requested
    if (Notification.permission === 'default') {
      // Delay showing to not overwhelm user
      const timer = setTimeout(() => setShowBanner(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleEnable = async () => {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    setShowBanner(false)
    
    if (granted) {
      showToast(t('notifications_enabled'))
    }
  }

  if (!showBanner || permission !== 'default') return null

  return (
    <div className="notification-banner" onClick={handleEnable}>
      <div className="notification-banner-icon">
        <Bell size={18} />
      </div>
      <div className="notification-banner-text">
        <h4>{t('enable_notifications')}</h4>
        <p>{t('get_alerts_ob')}</p>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
    </div>
  )
}
