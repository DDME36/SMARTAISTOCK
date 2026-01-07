'use client'

import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function LoadingScreen() {
  const { t } = useTranslation()
  
  return (
    <div className="loading-screen">
      {/* Logo */}
      <div className="loading-logo">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6E56CF"/>
              <stop offset="100%" stopColor="#27D796"/>
            </linearGradient>
          </defs>
          {/* Background circle */}
          <circle cx="40" cy="40" r="38" fill="rgba(110, 86, 207, 0.1)" stroke="rgba(110, 86, 207, 0.3)" strokeWidth="2"/>
          {/* Chart line */}
          <path 
            d="M20 50 L32 38 L44 45 L60 25" 
            stroke="url(#logoGradient)" 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          {/* Dot at end */}
          <circle cx="60" cy="25" r="6" fill="#27D796"/>
        </svg>
      </div>
      
      {/* App Name */}
      <div className="loading-title">BlockHunter</div>
      <div className="loading-subtitle">{t('pro_terminal')}</div>
      
      {/* Loading bar */}
      <div className="loading-bar">
        <div className="loading-bar-fill"></div>
      </div>
      
      {/* Loading text */}
      <div className="loading-status">{t('loading_market_data')}</div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card skeleton-card">
      <div className="skeleton" style={{ width: '60%', height: 16, marginBottom: 16 }}></div>
      <div className="skeleton" style={{ width: '100%', height: 80, marginBottom: 12 }}></div>
      <div className="skeleton" style={{ width: '40%', height: 14 }}></div>
    </div>
  )
}
