'use client'

import { useState } from 'react'
import { User, Lock, Eye, EyeOff, LogIn, UserPlus, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { login, register } = useAuthStore()
  const { t } = useTranslation()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Check confirm password on register
    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }
    
    setLoading(true)
    
    try {
      let result
      if (mode === 'login') {
        result = await login(username, password)
      } else {
        result = await register(username, password)
      }
      
      if (result.error) {
        setError(result.error)
      }
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="auth-screen">
      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1>BlockHunter</h1>
          <p>{t('auth.subtitle')}</p>
        </div>
        
        {/* Tabs */}
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            <LogIn size={16} />
            {t('auth.login')}
          </button>
          <button 
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
          >
            <UserPlus size={16} />
            {t('auth.register')}
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div className="auth-field">
            <label>{t('auth.username')}</label>
            <div className="auth-input-wrapper">
              <User size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.usernamePlaceholder')}
                required
                minLength={3}
              />
            </div>
          </div>
          
          <div className="auth-field">
            <label>{t('auth.password')}</label>
            <div className="auth-input-wrapper">
              <Lock size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
                minLength={4}
              />
              <button 
                type="button" 
                className="auth-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          {mode === 'register' && (
            <div className="auth-field">
              <label>{t('auth.confirmPassword')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  required
                  minLength={4}
                />
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading"></span>
            ) : mode === 'login' ? (
              <><LogIn size={18} /> {t('auth.loginButton')}</>
            ) : (
              <><UserPlus size={18} /> {t('auth.registerButton')}</>
            )}
          </button>
        </form>
        
        {/* Footer */}
        <p className="auth-footer">
          {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? t('auth.register') : t('auth.login')}
          </button>
        </p>
      </div>
    </div>
  )
}
