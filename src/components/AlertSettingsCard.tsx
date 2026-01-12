'use client'

import { useState, useEffect } from 'react'
import { Bell, TrendingUp, TrendingDown, Zap, BarChart3, Loader2, Info, Volume2, Sparkles, Shield, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useStore } from '@/store/useStore'

interface AlertSettings {
  alert_buy_zone: boolean
  alert_sell_zone: boolean
  alert_ob_entry: boolean
  alert_fvg: boolean
  alert_bos: boolean
  alert_choch: boolean
  min_quality_score: number
  volume_confirmed_only: boolean
  trend_aligned_only: boolean
}

const DEFAULT_SETTINGS: AlertSettings = {
  alert_buy_zone: true,
  alert_sell_zone: true,
  alert_ob_entry: true,
  alert_fvg: false,
  alert_bos: false,
  alert_choch: true,
  min_quality_score: 50,
  volume_confirmed_only: false,
  trend_aligned_only: false
}

// Presets for different user levels
const PRESETS = {
  beginner: {
    name: 'beginner',
    settings: {
      alert_buy_zone: false,
      alert_sell_zone: false,
      alert_ob_entry: true,  // Only critical alerts
      alert_fvg: false,
      alert_bos: false,
      alert_choch: false,
      min_quality_score: 70,  // High quality only
      volume_confirmed_only: true,  // Must have volume
      trend_aligned_only: true  // Must follow trend
    }
  },
  balanced: {
    name: 'balanced',
    settings: {
      alert_buy_zone: true,
      alert_sell_zone: true,
      alert_ob_entry: true,
      alert_fvg: false,
      alert_bos: false,
      alert_choch: true,
      min_quality_score: 50,
      volume_confirmed_only: false,
      trend_aligned_only: false
    }
  },
  advanced: {
    name: 'advanced',
    settings: {
      alert_buy_zone: true,
      alert_sell_zone: true,
      alert_ob_entry: true,
      alert_fvg: true,
      alert_bos: true,
      alert_choch: true,
      min_quality_score: 30,
      volume_confirmed_only: false,
      trend_aligned_only: false
    }
  }
}

export default function AlertSettingsCard() {
  const { t, language } = useTranslation()
  const { showToast } = useStore()
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  // Check which preset matches current settings
  useEffect(() => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      const matches = Object.keys(preset.settings).every(
        k => settings[k as keyof AlertSettings] === preset.settings[k as keyof AlertSettings]
      )
      if (matches) {
        setActivePreset(key)
        return
      }
    }
    setActivePreset('custom')
  }, [settings])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/user/alert-settings', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch alert settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newSettings: AlertSettings) => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/alert-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: newSettings })
      })
      
      if (res.ok) {
        showToast(t('settings_saved'))
      } else {
        showToast(t('failed_save'))
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      showToast(t('failed_save'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: keyof AlertSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] }
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  const handleSliderChange = (value: number) => {
    const newSettings = { ...settings, min_quality_score: value }
    setSettings(newSettings)
  }

  const handleSliderCommit = () => {
    saveSettings(settings)
  }

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS]
    if (preset) {
      const newSettings = { ...settings, ...preset.settings }
      setSettings(newSettings)
      saveSettings(newSettings)
      showToast(`${t(`preset_${presetKey}`)} ${t('preset_applied')}`)
    }
  }

  if (loading) {
    return (
      <div className="alert-settings-card loading">
        <Loader2 className="icon-spin" size={24} />
      </div>
    )
  }

  return (
    <div className="alert-settings-card">
      {/* Collapsible Header */}
      <button 
        className="alert-settings-header-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="settings-header">
          <Bell size={20} />
          <h3>{t('alert_settings')}</h3>
        </div>
        <div className="alert-settings-summary">
          <span className="preset-badge">
            {activePreset === 'beginner' ? (language === 'th' ? 'มือใหม่' : 'Beginner') :
             activePreset === 'balanced' ? (language === 'th' ? 'สมดุล' : 'Balanced') :
             activePreset === 'advanced' ? (language === 'th' ? 'ขั้นสูง' : 'Advanced') :
             (language === 'th' ? 'กำหนดเอง' : 'Custom')}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Collapsible Content */}
      {expanded && (
        <>
          {/* Preset Selection */}
          <div className="settings-section">
            <h4>{t('quick_setup')}</h4>
            <p className="settings-hint" style={{ marginBottom: 12 }}>
              {t('preset_hint')}
            </p>
            
            <div className="preset-buttons">
              <button 
                className={`preset-btn ${activePreset === 'beginner' ? 'active' : ''}`}
                onClick={() => applyPreset('beginner')}
              >
                <Shield size={18} />
                <div className="preset-info">
                  <span className="preset-name">{t('preset_beginner')}</span>
                  <span className="preset-desc">{t('preset_beginner_desc')}</span>
                </div>
              </button>
              
              <button 
                className={`preset-btn ${activePreset === 'balanced' ? 'active' : ''}`}
                onClick={() => applyPreset('balanced')}
              >
                <Target size={18} />
                <div className="preset-info">
                  <span className="preset-name">{t('preset_balanced')}</span>
                  <span className="preset-desc">{t('preset_balanced_desc')}</span>
                </div>
              </button>
              
              <button 
                className={`preset-btn ${activePreset === 'advanced' ? 'active' : ''}`}
                onClick={() => applyPreset('advanced')}
              >
                <Sparkles size={18} />
                <div className="preset-info">
                  <span className="preset-name">{t('preset_advanced')}</span>
                  <span className="preset-desc">{t('preset_advanced_desc')}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Alert Types */}
          <div className="settings-section">
            <h4>{t('alert_types')}</h4>

            {/* OB Entry - Most Important */}
            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <Zap size={18} className="icon-critical" />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('alert_ob_entry')}</span>
                    <span className="toggle-desc">{t('alert_ob_entry_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.alert_ob_entry}
                  onChange={() => handleToggle('alert_ob_entry')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
              <button className="info-btn" onClick={() => setShowInfo(showInfo === 'ob_entry' ? null : 'ob_entry')}>
                <Info size={14} />
              </button>
            </div>
            {showInfo === 'ob_entry' && (
              <div className="info-box">
                <p>{t('alert_ob_entry_info')}</p>
              </div>
            )}

            {/* Buy Zone */}
            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <TrendingUp size={18} className="icon-buy" />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('alert_buy_zone')}</span>
                    <span className="toggle-desc">{t('alert_buy_zone_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.alert_buy_zone}
                  onChange={() => handleToggle('alert_buy_zone')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>

            {/* Sell Zone */}
            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <TrendingDown size={18} className="icon-sell" />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('alert_sell_zone')}</span>
                    <span className="toggle-desc">{t('alert_sell_zone_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.alert_sell_zone}
                  onChange={() => handleToggle('alert_sell_zone')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>

            {/* CHoCH */}
            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <Zap size={18} />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('alert_choch')}</span>
                    <span className="toggle-desc">{t('alert_choch_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.alert_choch}
                  onChange={() => handleToggle('alert_choch')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>

            {/* FVG - Advanced */}
            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <BarChart3 size={18} />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('alert_fvg')}</span>
                    <span className="toggle-desc">{t('alert_fvg_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.alert_fvg}
                  onChange={() => handleToggle('alert_fvg')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>
          </div>

          {/* Quality Filters */}
          <div className="settings-section">
            <h4>{t('quality_filters')}</h4>
            <p className="settings-hint" style={{ marginBottom: 12 }}>
              {t('quality_filters_hint')}
            </p>

            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <Volume2 size={18} />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('volume_confirmed_only')}</span>
                    <span className="toggle-desc">{t('volume_confirmed_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.volume_confirmed_only}
                  onChange={() => handleToggle('volume_confirmed_only')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>

            <div className="toggle-row-wrapper">
              <label className="toggle-row">
                <div className="toggle-info">
                  <TrendingUp size={18} />
                  <div className="toggle-text">
                    <span className="toggle-label">{t('trend_aligned_only')}</span>
                    <span className="toggle-desc">{t('trend_aligned_desc')}</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.trend_aligned_only}
                  onChange={() => handleToggle('trend_aligned_only')}
                  disabled={saving}
                />
                <span className="toggle-switch"></span>
              </label>
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{t('min_quality_score')}</span>
                <span className="slider-value">{settings.min_quality_score}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="10"
                value={settings.min_quality_score}
                onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                onMouseUp={handleSliderCommit}
                onTouchEnd={handleSliderCommit}
                disabled={saving}
              />
              <div className="slider-labels">
                <span>{t('more_alerts')}</span>
                <span>{t('higher_quality')}</span>
              </div>
            </div>
          </div>

          {saving && (
            <div className="saving-indicator">
              <Loader2 size={14} className="icon-spin" />
              <span>{t('saving')}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
