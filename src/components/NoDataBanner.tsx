'use client'

import { AlertCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function NoDataBanner() {
  const { smcData } = useStore()
  const { t } = useTranslation()
  
  // Check if we have SMC analysis data
  const hasAnalysis = smcData?.stocks && Object.keys(smcData.stocks).length > 0
  const hasSentiment = smcData?.market_sentiment?.score !== undefined
  
  // If we have data, don't show banner
  if (hasAnalysis && hasSentiment) return null
  
  // Check how old the data is
  const generatedAt = smcData?.generated_at
  let dataAge = ''
  if (generatedAt) {
    // Handle timestamp without timezone - assume UTC
    let dataTime: Date
    if (generatedAt.endsWith('Z') || generatedAt.includes('+') || generatedAt.includes('-', 10)) {
      dataTime = new Date(generatedAt)
    } else {
      dataTime = new Date(generatedAt + 'Z')
    }
    const mins = Math.round((Date.now() - dataTime.getTime()) / 60000)
    if (mins < 60) dataAge = `${mins}m ago`
    else if (mins < 1440) dataAge = `${Math.round(mins / 60)}h ago`
    else dataAge = `${Math.round(mins / 1440)}d ago`
  }

  return (
    <div className="no-data-banner">
      <div className="no-data-banner-icon">
        <AlertCircle size={18} />
      </div>
      <div className="no-data-banner-text">
        <h4>{t('no_smc_data')}</h4>
        <p>
          {t('no_smc_data_desc')}
          {dataAge && <span style={{ marginLeft: 8, opacity: 0.7 }}>{t('last_update_label')}: {dataAge}</span>}
        </p>
        <p style={{ marginTop: 4 }}>
          <code>cd backend && python run_analysis.py</code>
        </p>
      </div>
    </div>
  )
}
