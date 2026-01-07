'use client'

import { useState, useRef, useEffect } from 'react'
import { RefreshCw, Bell, User, LogOut, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function Header() {
  const { setSmcData, showToast } = useStore()
  const { user, logout } = useAuthStore()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleLogout = async () => {
    await logout()
    setMenuOpen(false)
  }

  const getInitials = (username?: string) => {
    if (username) return username.charAt(0).toUpperCase()
    return 'U'
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
        
        {user && (
          <div className={`user-menu ${menuOpen ? 'open' : ''}`} ref={menuRef}>
            <button 
              className="user-menu-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <div className="user-avatar">
                {getInitials(user.username)}
              </div>
              <ChevronDown size={14} />
            </button>
            
            <div className="user-menu-dropdown">
              <div className="user-menu-item" style={{ cursor: 'default' }}>
                <User size={16} />
                <span>{user.username}</span>
              </div>
              <button className="user-menu-item danger" onClick={handleLogout}>
                <LogOut size={16} />
                <span>{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
