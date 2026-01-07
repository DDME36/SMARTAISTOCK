'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed
    const wasDismissed = localStorage.getItem('pwa-install-dismissed')
    if (wasDismissed) {
      setDismissed(true)
      return
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return
    }

    const handler = (e: Event) => {
      // Don't prevent default - let browser handle it naturally
      // We just capture the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Show banner after a short delay to not interrupt user
      setTimeout(() => setShowBanner(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showBanner || dismissed) return null

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <Smartphone size={24} />
        </div>
        <div className="pwa-install-text">
          <h4>{t('install_app')}</h4>
          <p>{t('install_desc')}</p>
        </div>
        <button 
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="pwa-install-actions">
        <button className="btn" onClick={handleDismiss}>
          {t('not_now')}
        </button>
        <button className="btn btn-primary" onClick={handleInstall}>
          <Download size={16} /> {t('install')}
        </button>
      </div>
    </div>
  )
}
