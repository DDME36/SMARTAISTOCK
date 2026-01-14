'use client'

import { useState, useEffect } from 'react'
import { Download, Globe, Bell, BellOff, Trash2, RefreshCw, Check, Info, Shield, LogOut, User, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/hooks/useTranslation'
import { subscribeToPush, isPushSubscribed } from '@/lib/notifications'
import ConfirmDialog from './ConfirmDialog'
import AlertSettingsCard from './AlertSettingsCard'

export default function SettingsView() {
  const { watchlist, language, setLanguage, showToast } = useStore()
  const { user, logout } = useAuthStore()
  const { t } = useTranslation()
  
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'default'>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationStatus(Notification.permission)
    }
    // Check if already subscribed to push
    isPushSubscribed().then(setPushSubscribed)
  }, [])

  const handleNotificationToggle = async () => {
    // If denied, tell user to go to settings
    if (notificationStatus === 'denied') {
      showToast(t('browser_settings_hint'))
      return
    }

    // If already fully set up, just show success
    if (pushSubscribed && notificationStatus === 'granted') {
      showToast(t('notifications_enabled'))
      return
    }

    setSubscribing(true)
    
    try {
      // Request permission if not granted yet
      if (notificationStatus !== 'granted') {
        const permission = await Notification.requestPermission()
        setNotificationStatus(permission)
        
        if (permission === 'denied') {
          showToast(t('browser_settings_hint'))
          return
        }
        
        if (permission !== 'granted') {
          showToast('Permission not granted')
          return
        }
      }
      
      // Permission granted - try to subscribe
      const success = await subscribeToPush()
      
      if (success) {
        setPushSubscribed(true)
        showToast(t('notifications_enabled'))
      } else {
        // Even if server subscribe fails, permission is still granted
        setPushSubscribed(false)
        showToast(t('browser_settings_hint'))
      }
    } catch (error) {
      console.error('Notification error:', error)
      showToast('Failed to enable notifications')
    } finally {
      setSubscribing(false)
    }
  }

  const exportWatchlist = () => {
    const data = {
      symbols: watchlist,
      interval: "1h",
      updated_at: new Date().toISOString()
    }
    const json = JSON.stringify(data, null, 2)

    navigator.clipboard.writeText(json).then(() => {
      showToast(t('copied'))
    }).catch(() => {
      prompt(t('copy_prompt'), json)
    })
  }

  const clearAllData = async () => {
    setShowClearConfirm(false)
    setClearing(true)
    
    // Clear localStorage
    localStorage.clear()
    
    // Clear caches
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(key => caches.delete(key)))
    }
    
    setClearing(false)
    showToast(t('cleared_data'))
    
    // Reload page
    setTimeout(() => window.location.reload(), 500)
  }

  const refreshData = async () => {
    showToast(t('refreshing'))
    try {
      const res = await fetch('/data/smc_data.json?t=' + Date.now())
      if (res.ok) {
        showToast(t('data_refreshed'))
        window.location.reload()
      }
    } catch {
      showToast(t('failed_refresh'))
    }
  }

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    await logout()
    showToast(t('auth.logout'))
  }

  return (
    <main className="settings-page">
      {/* Account Section */}
      {user && (
        <div className="settings-card">
          <div className="settings-card-header">
            <User size={20} />
            <div>
              <h3>{t('auth.welcome')}, {user.username}</h3>
              <p>Account</p>
            </div>
          </div>
          <div className="settings-actions">
            <button className="action-btn danger" onClick={() => setShowLogoutConfirm(true)}>
              <LogOut size={18} />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Language Section */}
      <div className="settings-card">
        <div className="settings-card-header">
          <Globe size={20} />
          <div>
            <h3>{t('language')}</h3>
            <p>{t('choose_language')}</p>
          </div>
        </div>
        <div className="language-toggle">
          <button 
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            <span className="lang-code">US</span>
            <span className="lang-name">English</span>
            {language === 'en' && <Check size={16} className="lang-check" />}
          </button>
          <button 
            className={`lang-btn ${language === 'th' ? 'active' : ''}`}
            onClick={() => setLanguage('th')}
          >
            <span className="lang-code">TH</span>
            <span className="lang-name">ไทย</span>
            {language === 'th' && <Check size={16} className="lang-check" />}
          </button>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="settings-card">
        <div className="settings-card-header">
          <Bell size={20} />
          <div>
            <h3>{t('push_notifications')}</h3>
            <p>{t('get_alerts_ob')}</p>
          </div>
        </div>
        <button 
          className={`notification-toggle ${notificationStatus === 'granted' && pushSubscribed ? 'enabled' : ''}`}
          onClick={handleNotificationToggle}
          disabled={subscribing}
        >
          {subscribing ? (
            <>
              <Loader2 size={18} className="icon-spin" />
              <span>Subscribing...</span>
            </>
          ) : notificationStatus === 'granted' && pushSubscribed ? (
            <>
              <Bell size={18} />
              <span>{t('notifications_enabled')}</span>
              <span className="status-dot enabled"></span>
            </>
          ) : notificationStatus === 'denied' ? (
            <>
              <BellOff size={18} />
              <span>{t('notifications_blocked')}</span>
              <span className="status-dot disabled"></span>
            </>
          ) : (
            <>
              <Bell size={18} />
              <span>{t('enable_notifications')}</span>
              <span className="status-dot"></span>
            </>
          )}
        </button>
        
        {/* Test buttons when notifications are enabled */}
        {notificationStatus === 'granted' && pushSubscribed && (
          <div className="notification-test-buttons">
            <button 
              className="test-btn"
              onClick={async () => {
                const { testNotification } = await import('@/lib/notifications')
                const success = await testNotification()
                showToast(success ? (language === 'th' ? 'ส่งแจ้งเตือนแล้ว (Local)' : 'Local notification sent') : 'Failed')
              }}
            >
              {language === 'th' ? 'ทดสอบ Local' : 'Test Local'}
            </button>
            <button 
              className="test-btn server"
              onClick={async () => {
                showToast(language === 'th' ? 'กำลังทดสอบ...' : 'Testing...')
                try {
                  const res = await fetch('/api/push/test', { 
                    method: 'POST',
                    credentials: 'include'
                  })
                  const data = await res.json()
                  if (res.ok) {
                    showToast(language === 'th' ? 'ส่งจาก Server สำเร็จ!' : 'Server push sent!')
                  } else {
                    console.error('Server test failed:', data)
                    showToast(data.message || data.error || 'Failed')
                  }
                } catch (err) {
                  console.error('Server test error:', err)
                  showToast('Server error')
                }
              }}
            >
              {language === 'th' ? 'ทดสอบ Server' : 'Test Server'}
            </button>
          </div>
        )}
        
        {notificationStatus === 'denied' && (
          <p className="settings-hint">
            <Info size={14} /> {t('browser_settings_hint')}
          </p>
        )}
        {notificationStatus === 'granted' && pushSubscribed && (
          <p className="settings-hint" style={{ marginTop: 8, color: 'var(--success)' }}>
            <Info size={14} /> {t('notification_subscribed_hint')}
          </p>
        )}
      </div>

      {/* Alert Settings - Always show for configuring alert preferences */}
      <AlertSettingsCard />

      {/* Advanced Settings Toggle */}
      <button 
        className="settings-advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <Settings2 size={18} />
        <span>{language === 'th' ? 'การตั้งค่าขั้นสูง' : 'Advanced Settings'}</span>
        {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Advanced Settings - Collapsible */}
      {showAdvanced && (
        <>
          {/* Data Management */}
          <div className="settings-card">
            <div className="settings-card-header">
              <Shield size={20} />
              <div>
                <h3>{t('data_management')}</h3>
                <p>{t('export_clear_data')}</p>
              </div>
            </div>
            <div className="settings-actions">
              <button className="action-btn" onClick={exportWatchlist}>
                <Download size={18} />
                <span>{t('export_watchlist')}</span>
              </button>
              <button className="action-btn" onClick={refreshData}>
                <RefreshCw size={18} />
                <span>{t('refresh_data')}</span>
              </button>
              <button className="action-btn danger" onClick={() => setShowClearConfirm(true)} disabled={clearing}>
                <Trash2 size={18} />
                <span>{clearing ? t('clearing') : t('clear_all_data')}</span>
              </button>
            </div>
          </div>

          {/* Stats Card */}
          <div className="settings-card stats-card">
            <div className="stat-item">
              <span className="stat-number">{watchlist.length}</span>
              <span className="stat-label">{t('full_watchlist')}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">{notificationStatus === 'granted' && pushSubscribed ? <Bell size={20} /> : <BellOff size={20} />}</span>
              <span className="stat-label">{t('alerts')}</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">v2.1</span>
              <span className="stat-label">{t('version')}</span>
            </div>
          </div>
        </>
      )}

      {/* App Info */}
      <div className="settings-card app-info">
        <div className="app-logo">
          <svg viewBox="0 0 100 100" width="32" height="32">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6E56CF"/>
                <stop offset="100%" stopColor="#27D796"/>
              </linearGradient>
            </defs>
            <path d="M25 70 L40 45 L55 55 L75 25" stroke="url(#logoGrad)" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="75" cy="25" r="10" fill="#27D796"/>
          </svg>
        </div>
        <div className="app-details">
          <h4>BlockHunter</h4>
          <p>{t('app_subtitle')}</p>
          <p className="app-credit">by DOME • @ddme36</p>
        </div>
      </div>

      {/* Clear Data Confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title={t('confirm_clear_title')}
        message={t('confirm_clear_desc')}
        confirmText={t('clear_all_data')}
        cancelText={t('cancel')}
        variant="danger"
        onConfirm={clearAllData}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Logout Confirmation */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title={t('confirm_logout_title')}
        message={t('confirm_logout_desc')}
        confirmText={t('auth.logout')}
        cancelText={t('cancel')}
        variant="warning"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </main>
  )
}
