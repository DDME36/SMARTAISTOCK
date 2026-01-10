'use client'

import { useState, useEffect } from 'react'
import { Bell, TrendingUp, TrendingDown, Zap, BarChart3, Loader2, Check, Volume2 } from 'lucide-react'
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

export default function AlertSettingsCard() {
  const { t } = useTranslation()
  const { showToast } = useStore()
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

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
        showToast('✅ ' + t('settings_saved'))
      } else {
        showToast('❌ ' + t('failed_save'))
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      showToast('❌ ' + t('failed_save'))
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

  if (loading) {
    return (
      <div className="alert-settings-card loading">
        <Loader2 className="icon-spin" size={24} />
      </div>
    )
  }

  return (
    <div className="alert-settings-card">
      <div className="settings-header">
        <Bell size={20} />
        <h3>{t('alert_settings')}</h3>
      </div>

      <div className="settings-section">
        <h4>{t('alert_types')}</h4>
        
        <label className="toggle-row">
          <div className="toggle-info">
            <TrendingUp size={18} className="icon-buy" />
            <span>{t('alert_buy_zone')}</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.alert_buy_zone}
            onChange={() => handleToggle('alert_buy_zone')}
            disabled={saving}
          />
          <span className="toggle-switch"></span>
        </label>

        <label className="toggle-row">
          <div className="toggle-info">
            <TrendingDown size={18} className="icon-sell" />
            <span>{t('alert_sell_zone')}</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.alert_sell_zone}
            onChange={() => handleToggle('alert_sell_zone')}
            disabled={saving}
          />
          <span className="toggle-switch"></span>
        </label>

        <label className="toggle-row">
          <div className="toggle-info">
            <Zap size={18} className="icon-critical" />
            <span>{t('alert_ob_entry')}</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.alert_ob_entry}
            onChange={() => handleToggle('alert_ob_entry')}
            disabled={saving}
          />
          <span className="toggle-switch"></span>
        </label>

        <label className="toggle-row">
          <div className="toggle-info">
            <BarChart3 size={18} />
            <span>{t('alert_fvg')}</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.alert_fvg}
            onChange={() => handleToggle('alert_fvg')}
            disabled={saving}
          />
          <span className="toggle-switch"></span>
        </label>

        <label className="toggle-row">
          <div className="toggle-info">
            <Zap size={18} />
            <span>{t('alert_choch')}</span>
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

      <div className="settings-section">
        <h4>{t('quality_filters')}</h4>

        <label className="toggle-row">
          <div className="toggle-info">
            <Volume2 size={18} />
            <span>{t('volume_confirmed_only')}</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.volume_confirmed_only}
            onChange={() => handleToggle('volume_confirmed_only')}
            disabled={saving}
          />
          <span className="toggle-switch"></span>
        </label>

        <label className="toggle-row">
          <div className="toggle-info">
            <TrendingUp size={18} />
            <span>{t('trend_aligned_only')}</span>
          </div>
          <input 
            type="checkbox" 
            checked={settings.trend_aligned_only}
            onChange={() => handleToggle('trend_aligned_only')}
            disabled={saving}
          />
          <span className="toggle-switch"></span>
        </label>

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
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {saving && (
        <div className="saving-indicator">
          <Loader2 size={14} className="icon-spin" />
          <span>{t('saving')}</span>
        </div>
      )}
    </div>
  )
}
