'use client'

import { useState, useEffect } from 'react'
import { Bell, Loader2, Shield, Target, Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react'
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

// Simplified presets - no complex % settings
const PRESETS = {
  essential: {
    name: 'essential',
    icon: Shield,
    color: '#10b981',
    settings: {
      alert_buy_zone: false,
      alert_sell_zone: false,
      alert_ob_entry: true,
      alert_fvg: false,
      alert_bos: false,
      alert_choch: false,
      min_quality_score: 70,
      volume_confirmed_only: true,
      trend_aligned_only: true
    }
  },
  balanced: {
    name: 'balanced',
    icon: Target,
    color: '#f59e0b',
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
  all: {
    name: 'all',
    icon: Sparkles,
    color: '#8b5cf6',
    settings: {
      alert_buy_zone: true,
      alert_sell_zone: true,
      alert_ob_entry: true,
      alert_fvg: true,
      alert_bos: true,
      alert_choch: true,
      min_quality_score: 0,
      volume_confirmed_only: false,
      trend_aligned_only: false
    }
  }
}

const DEFAULT_SETTINGS = PRESETS.balanced.settings

export default function AlertSettingsCard() {
  const { t, language } = useTranslation()
  const { showToast, alertSettings, alertSettingsLoaded, fetchAlertSettings, setAlertSettings } = useStore()
  const [saving, setSaving] = useState(false)
  const [activePreset, setActivePreset] = useState<string>('balanced')
  const [expanded, setExpanded] = useState(false)
  
  const settings = alertSettings || DEFAULT_SETTINGS

  useEffect(() => {
    if (!alertSettingsLoaded) {
      fetchAlertSettings()
    }
  }, [alertSettingsLoaded, fetchAlertSettings])

  // Detect which preset matches
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

  const saveSettings = async (newSettings: AlertSettings) => {
    setSaving(true)
    setAlertSettings(newSettings)
    try {
      const res = await fetch('/api/user/alert-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: newSettings })
      })
      
      if (res.ok) {
        showToast(language === 'th' ? 'บันทึกแล้ว' : 'Saved')
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS]
    if (preset) {
      saveSettings(preset.settings)
    }
  }

  const getPresetLabel = (key: string) => {
    if (language === 'th') {
      switch (key) {
        case 'essential': return 'เฉพาะสำคัญ'
        case 'balanced': return 'สมดุล'
        case 'all': return 'ทั้งหมด'
        default: return 'กำหนดเอง'
      }
    }
    switch (key) {
      case 'essential': return 'Essential'
      case 'balanced': return 'Balanced'
      case 'all': return 'All Signals'
      default: return 'Custom'
    }
  }

  const getPresetDesc = (key: string) => {
    if (language === 'th') {
      switch (key) {
        case 'essential': return 'แจ้งเตือนเฉพาะเมื่อราคาเข้าโซน OB คุณภาพสูง'
        case 'balanced': return 'แจ้งเตือนโซนซื้อ/ขาย และสัญญาณกลับตัว'
        case 'all': return 'แจ้งเตือนทุกสัญญาณ รวม FVG และ BOS'
        default: return ''
      }
    }
    switch (key) {
      case 'essential': return 'Only high-quality OB entry alerts'
      case 'balanced': return 'Buy/Sell zones + trend reversals'
      case 'all': return 'All signals including FVG & BOS'
      default: return ''
    }
  }

  if (!alertSettingsLoaded) {
    return (
      <div className="alert-settings-card loading">
        <Loader2 className="icon-spin" size={24} />
      </div>
    )
  }

  return (
    <div className="alert-settings-card">
      {/* Header */}
      <button 
        className="alert-settings-header-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="settings-header">
          <Bell size={20} />
          <h3>{language === 'th' ? 'การแจ้งเตือน' : 'Notifications'}</h3>
        </div>
        <div className="alert-settings-summary">
          <span className="preset-badge" style={{ 
            background: PRESETS[activePreset as keyof typeof PRESETS]?.color 
              ? `${PRESETS[activePreset as keyof typeof PRESETS].color}20` 
              : 'var(--bg-tertiary)',
            color: PRESETS[activePreset as keyof typeof PRESETS]?.color || 'var(--text-secondary)'
          }}>
            {getPresetLabel(activePreset)}
          </span>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="alert-settings-content">
          <p className="settings-hint">
            {language === 'th' 
              ? 'เลือกระดับการแจ้งเตือนที่ต้องการ' 
              : 'Choose your notification level'}
          </p>
          
          <div className="preset-cards">
            {Object.entries(PRESETS).map(([key, preset]) => {
              const Icon = preset.icon
              const isActive = activePreset === key
              
              return (
                <button
                  key={key}
                  className={`preset-card ${isActive ? 'active' : ''}`}
                  onClick={() => applyPreset(key)}
                  disabled={saving}
                  style={{ 
                    '--preset-color': preset.color,
                    borderColor: isActive ? preset.color : 'transparent'
                  } as React.CSSProperties}
                >
                  <div className="preset-card-icon" style={{ background: `${preset.color}20`, color: preset.color }}>
                    <Icon size={20} />
                  </div>
                  <div className="preset-card-content">
                    <div className="preset-card-title">
                      {getPresetLabel(key)}
                      {isActive && <Check size={14} style={{ color: preset.color }} />}
                    </div>
                    <div className="preset-card-desc">{getPresetDesc(key)}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {saving && (
            <div className="saving-indicator">
              <Loader2 size={14} className="icon-spin" />
              <span>{language === 'th' ? 'กำลังบันทึก...' : 'Saving...'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
