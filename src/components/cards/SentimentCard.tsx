'use client'

import { TrendingUp, AlertTriangle, Zap, Shield } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

// AI Mascot SVG Component
function AIMascot({ mood }: { mood: 'bullish' | 'bearish' | 'neutral' | 'excited' | 'worried' }) {
  const colors = {
    bullish: { primary: '#27D796', secondary: '#1a9e6e', glow: 'rgba(39, 215, 150, 0.4)' },
    bearish: { primary: '#FF4F5E', secondary: '#cc3f4b', glow: 'rgba(255, 79, 94, 0.4)' },
    neutral: { primary: '#6E56CF', secondary: '#5842a3', glow: 'rgba(110, 86, 207, 0.4)' },
    excited: { primary: '#FFB224', secondary: '#cc8e1d', glow: 'rgba(255, 178, 36, 0.4)' },
    worried: { primary: '#FF6B35', secondary: '#cc562a', glow: 'rgba(255, 107, 53, 0.4)' }
  }
  
  const c = colors[mood]
  
  return (
    <svg viewBox="0 0 100 100" className="ai-mascot-svg">
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c.primary}/>
          <stop offset="100%" stopColor={c.secondary}/>
        </linearGradient>
      </defs>
      
      <circle cx="50" cy="50" r="45" fill={c.glow} className="pulse-glow"/>
      <rect x="20" y="25" width="60" height="55" rx="12" fill="url(#bodyGrad)"/>
      <rect x="26" y="32" width="48" height="35" rx="6" fill="#0a0a15"/>
      
      {mood === 'bullish' || mood === 'excited' ? (
        <>
          <path d="M38 47 L42 42 L46 47" stroke={c.primary} strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M54 47 L58 42 L62 47" stroke={c.primary} strokeWidth="3" fill="none" strokeLinecap="round"/>
        </>
      ) : mood === 'bearish' || mood === 'worried' ? (
        <>
          <path d="M38 42 L42 47 L46 42" stroke={c.primary} strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M54 42 L58 47 L62 42" stroke={c.primary} strokeWidth="3" fill="none" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="42" cy="45" r="4" fill={c.primary}/>
          <circle cx="58" cy="45" r="4" fill={c.primary}/>
        </>
      )}
      
      {mood === 'bullish' || mood === 'excited' ? (
        <path d="M42 55 Q50 62 58 55" stroke={c.primary} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      ) : mood === 'bearish' || mood === 'worried' ? (
        <path d="M42 60 Q50 54 58 60" stroke={c.primary} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      ) : (
        <line x1="42" y1="58" x2="58" y2="58" stroke={c.primary} strokeWidth="2.5" strokeLinecap="round"/>
      )}
      
      <line x1="50" y1="25" x2="50" y2="15" stroke={c.primary} strokeWidth="3" strokeLinecap="round"/>
      <circle cx="50" cy="12" r="4" fill={c.primary} className="antenna-blink"/>
      <rect x="14" y="42" width="6" height="12" rx="2" fill={c.secondary}/>
      <rect x="80" y="42" width="6" height="12" rx="2" fill={c.secondary}/>
    </svg>
  )
}

interface AIAnalysis {
  headline: string
  analysis: string
  action: string
  actionType: 'buy' | 'hold' | 'avoid'
}

interface AnalysisTexts {
  extreme_fear: { headline: string; action: string }
  bullish: { headline: string; action: string }
  consolidation: { headline: string; action: string }
  caution: { headline: string; action: string }
  high_risk: { headline: string; action: string }
  // Analysis parts
  market_fearful: string
  vix_stable: string
  vix_stable_detail: string
  high_fear: string
  high_fear_detail: string
  fg_panic: string
  smart_money: string
  positive_signals: string
  low_vix: string
  low_vix_detail: string
  volatility_ok: string
  volatility_ok_detail: string
  breadth_healthy: string
  breadth_healthy_detail: string
  selective_buy: string
  trend_follow: string
  mixed_signals: string
  vix_neutral: string
  vix_neutral_detail: string
  no_control: string
  breadth_at: string
  breadth_indecision: string
  wait_direction: string
  warning_signals: string
  elevated_vix: string
  elevated_vix_detail: string
  greed_correction: string
  greed_correction_detail: string
  reduce_size: string
  danger_zone: string
  vix_spike: string
  vix_spike_detail: string
  bearish_aligned: string
  bearish_aligned_detail: string
  extreme_greed: string
  extreme_greed_detail: string
  cash_priority: string
}

const analysisTexts: Record<'en' | 'th', AnalysisTexts> = {
  en: {
    extreme_fear: { headline: "Extreme Fear = Opportunity", action: "DCA into quality stocks" },
    bullish: { headline: "Bullish Momentum Building", action: "Follow the trend" },
    consolidation: { headline: "Market in Consolidation", action: "Wait for confirmation" },
    caution: { headline: "Caution: Risk Elevated", action: "Reduce exposure" },
    high_risk: { headline: "High Risk Environment", action: "Stay in cash" },
    market_fearful: "Market sentiment is heavily fearful with score",
    vix_stable: "VIX remains stable",
    vix_stable_detail: "indicating controlled volatility.",
    high_fear: "High fear",
    high_fear_detail: "often precedes reversals.",
    fg_panic: "Fear & Greed confirms panic mode.",
    smart_money: "Smart money typically accumulates during these periods.",
    positive_signals: "Positive signals detected with score",
    low_vix: "Low VIX",
    low_vix_detail: "suggests calm markets.",
    volatility_ok: "Volatility",
    volatility_ok_detail: "is manageable.",
    breadth_healthy: "Market breadth",
    breadth_healthy_detail: "is healthy at",
    selective_buy: "Selective buying recommended.",
    trend_follow: "Trend followers should stay positioned.",
    mixed_signals: "Mixed signals with score",
    vix_neutral: "VIX",
    vix_neutral_detail: "shows neutral volatility.",
    no_control: "Neither bulls nor bears have clear control.",
    breadth_at: "Breadth at",
    breadth_indecision: "indicates indecision.",
    wait_direction: "Wait for clearer direction before committing capital.",
    warning_signals: "Warning signals present with score",
    elevated_vix: "Elevated VIX",
    elevated_vix_detail: "indicates rising fear.",
    greed_correction: "Greed levels",
    greed_correction_detail: "suggest potential correction.",
    reduce_size: "Consider reducing position sizes and tightening stops.",
    danger_zone: "Danger zone with score",
    vix_spike: "VIX spike",
    vix_spike_detail: "signals panic.",
    bearish_aligned: "Multiple bearish indicators",
    bearish_aligned_detail: "aligned.",
    extreme_greed: "Extreme greed",
    extreme_greed_detail: "often precedes crashes.",
    cash_priority: "Cash preservation is priority."
  },
  th: {
    extreme_fear: { headline: "ความกลัวสุดขีด = โอกาส", action: "ทยอยซื้อหุ้นคุณภาพ" },
    bullish: { headline: "โมเมนตัมขาขึ้นกำลังก่อตัว", action: "เทรดตามเทรนด์" },
    consolidation: { headline: "ตลาดอยู่ในช่วงพักตัว", action: "รอสัญญาณยืนยัน" },
    caution: { headline: "ระวัง: ความเสี่ยงสูงขึ้น", action: "ลดความเสี่ยง" },
    high_risk: { headline: "สภาพแวดล้อมเสี่ยงสูง", action: "ถือเงินสด" },
    market_fearful: "ตลาดมีความกลัวสูงมาก คะแนน",
    vix_stable: "VIX ยังคงทรงตัว",
    vix_stable_detail: "บ่งบอกความผันผวนอยู่ในระดับควบคุมได้",
    high_fear: "ความกลัวสูง",
    high_fear_detail: "มักเกิดก่อนการกลับตัว",
    fg_panic: "Fear & Greed ยืนยันโหมดตื่นตระหนก",
    smart_money: "Smart Money มักสะสมในช่วงเวลาเหล่านี้",
    positive_signals: "ตรวจพบสัญญาณบวก คะแนน",
    low_vix: "VIX ต่ำ",
    low_vix_detail: "บ่งบอกตลาดสงบ",
    volatility_ok: "ความผันผวน",
    volatility_ok_detail: "อยู่ในระดับจัดการได้",
    breadth_healthy: "Market Breadth",
    breadth_healthy_detail: "แข็งแกร่งที่",
    selective_buy: "แนะนำซื้อเลือกสรร",
    trend_follow: "นักเทรดตามเทรนด์ควรถือสถานะต่อ",
    mixed_signals: "สัญญาณผสม คะแนน",
    vix_neutral: "VIX",
    vix_neutral_detail: "แสดงความผันผวนปานกลาง",
    no_control: "ทั้งฝั่งซื้อและขายยังไม่มีใครควบคุมชัดเจน",
    breadth_at: "Breadth ที่",
    breadth_indecision: "บ่งบอกความไม่แน่นอน",
    wait_direction: "รอทิศทางที่ชัดเจนก่อนลงทุน",
    warning_signals: "มีสัญญาณเตือน คะแนน",
    elevated_vix: "VIX สูงขึ้น",
    elevated_vix_detail: "บ่งบอกความกลัวเพิ่มขึ้น",
    greed_correction: "ระดับความโลภ",
    greed_correction_detail: "อาจนำไปสู่การปรับฐาน",
    reduce_size: "พิจารณาลดขนาดพอร์ตและตั้ง Stop Loss ให้แน่นขึ้น",
    danger_zone: "โซนอันตราย คะแนน",
    vix_spike: "VIX พุ่งสูง",
    vix_spike_detail: "ส่งสัญญาณตื่นตระหนก",
    bearish_aligned: "สัญญาณขาลงหลายตัว",
    bearish_aligned_detail: "สอดคล้องกัน",
    extreme_greed: "ความโลภสุดขีด",
    extreme_greed_detail: "มักเกิดก่อนตลาดร่วง",
    cash_priority: "การรักษาเงินสดเป็นสิ่งสำคัญที่สุด"
  }
}

function getAIAnalysis(score: number, lang: 'en' | 'th', vixValue?: number, fgScore?: number, breadthPct?: number): AIAnalysis {
  const t = analysisTexts[lang]
  
  if (score >= 75) {
    return {
      headline: t.extreme_fear.headline,
      analysis: `${t.market_fearful} [score:${score}]/100. ${vixValue && vixValue < 20 ? `[bullish:${t.vix_stable}] ${t.vix_stable_detail}` : `[warning:${t.high_fear}] ${t.high_fear_detail}`} ${fgScore && fgScore < 30 ? `[bearish:${t.fg_panic}]` : ''} ${t.smart_money}`,
      action: t.extreme_fear.action,
      actionType: 'buy'
    }
  }
  if (score >= 60) {
    return {
      headline: t.bullish.headline,
      analysis: `${t.positive_signals} [score:${score}]/100. ${vixValue && vixValue < 18 ? `[bullish:${t.low_vix}] ${t.low_vix_detail}` : `[neutral:${t.volatility_ok}] ${t.volatility_ok_detail}`} ${breadthPct && breadthPct > 60 ? `[bullish:${t.breadth_healthy}] ${t.breadth_healthy_detail} [number:${breadthPct}%].` : t.selective_buy} ${t.trend_follow}`,
      action: t.bullish.action,
      actionType: 'buy'
    }
  }
  if (score >= 45) {
    return {
      headline: t.consolidation.headline,
      analysis: `${t.mixed_signals} [score:${score}]/100. ${vixValue ? `[neutral:${t.vix_neutral}] [number:${vixValue}] ${t.vix_neutral_detail}` : ''} ${t.no_control} ${breadthPct ? `${t.breadth_at} [number:${breadthPct}%] ${t.breadth_indecision}` : ''} ${t.wait_direction}`,
      action: t.consolidation.action,
      actionType: 'hold'
    }
  }
  if (score >= 30) {
    return {
      headline: t.caution.headline,
      analysis: `${t.warning_signals} [score:${score}]/100. ${vixValue && vixValue > 20 ? `[bearish:${t.elevated_vix}] ${t.elevated_vix_detail}` : ''} ${fgScore && fgScore > 60 ? `[warning:${t.greed_correction}] ${t.greed_correction_detail}` : ''} ${t.reduce_size}`,
      action: t.caution.action,
      actionType: 'avoid'
    }
  }
  return {
    headline: t.high_risk.headline,
    analysis: `${t.danger_zone} [score:${score}]/100. ${vixValue && vixValue > 25 ? `[bearish:${t.vix_spike}] ${t.vix_spike_detail}` : `[bearish:${t.bearish_aligned}] ${t.bearish_aligned_detail}`} ${fgScore && fgScore > 70 ? `[warning:${t.extreme_greed}] ${t.extreme_greed_detail}` : ''} ${t.cash_priority}`,
    action: t.high_risk.action,
    actionType: 'avoid'
  }
}

// Parse analysis text and highlight keywords
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(\[(?:bullish|bearish|neutral|warning|score|number):[^\]]+\])/g)
  
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\[(bullish|bearish|neutral|warning|score|number):([^\]]+)\]/)
        if (match) {
          const [, type, content] = match
          let className = 'highlight-'
          switch (type) {
            case 'bullish': className += 'bullish'; break
            case 'bearish': className += 'bearish'; break
            case 'warning': className += 'warning'; break
            case 'score': className += 'score'; break
            case 'number': className += 'number'; break
            default: className += 'neutral'
          }
          return <span key={i} className={className}>{content}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function getMood(score: number): 'bullish' | 'bearish' | 'neutral' | 'excited' | 'worried' {
  if (score >= 75) return 'excited'
  if (score >= 60) return 'bullish'
  if (score >= 45) return 'neutral'
  if (score >= 30) return 'worried'
  return 'bearish'
}

function getScoreColor(score: number): string {
  if (score >= 60) return 'var(--accent-success)'
  if (score >= 45) return 'var(--accent-warning)'
  return 'var(--accent-danger)'
}

export default function SentimentCard() {
  const { smcData, language } = useStore()
  const { t } = useTranslation()
  
  const sentiment = smcData?.market_sentiment
  const score = sentiment?.score ?? 50
  const rec = sentiment?.recommendation ?? 'HOLD'
  
  const indicators = sentiment?.indicators
  const vix = indicators?.vix
  const fearGreed = indicators?.fear_greed
  const breadth = indicators?.market_breadth
  const ma = indicators?.moving_averages
  const yields = indicators?.treasury_yields
  
  const mood = getMood(score)
  const scoreColor = getScoreColor(score)
  
  const totalBreadth = (breadth?.bullish ?? 0) + (breadth?.bearish ?? 0) + (breadth?.neutral ?? 0)
  const breadthPct = totalBreadth > 0 ? Math.round((breadth?.bullish ?? 0) / totalBreadth * 100) : 0
  
  const aiAnalysis = getAIAnalysis(score, language, vix?.value, fearGreed?.score, breadthPct)
  
  let badgeClass = ''
  let badgeIcon = null
  let badgeText = rec.replace('_', ' ')
  
  if (rec.includes('BUY')) {
    badgeClass = 'badge-bull'
    badgeIcon = <TrendingUp size={12} />
    badgeText = language === 'th' ? 'ซื้อ' : 'BUY'
  } else if (rec.includes('AVOID') || rec.includes('CAUTIOUS')) {
    badgeClass = 'badge-bear'
    badgeIcon = <Shield size={12} />
    badgeText = language === 'th' ? 'ระวัง' : rec.replace('_', ' ')
  } else if (rec.includes('HOLD')) {
    badgeText = language === 'th' ? 'ถือ' : 'HOLD'
  }

  const yieldWarning = language === 'th' 
    ? 'Yield Curve กลับหัว — สัญญาณเตือนถดถอย'
    : 'Yield Curve Inverted — Recession Warning'

  return (
    <article className="card sentiment-card col-span-2 row-span-2">
      {/* Header */}
      <div className="card-title">
        <span className="sentiment-title">
          <Zap size={16} style={{ color: scoreColor }} /> {t('ai_market_sense')}
        </span>
        <span className={`badge ${badgeClass}`}>
          {badgeIcon} {badgeText}
        </span>
      </div>
      
      {/* Main Content - 2 Column Grid */}
      <div className="sentiment-grid">
        {/* Left Column - Visual */}
        <div className="sentiment-visual">
          <div className="visual-stack">
            <div className="ai-robot-wrapper">
              <AIMascot mood={mood} />
            </div>
            <div className="ai-gauge-container">
              <svg className="ai-gauge-svg" viewBox="0 0 200 110">
                <path 
                  d="M 20 100 A 80 80 0 0 1 180 100" 
                  fill="none" 
                  stroke="rgba(255,255,255,0.05)" 
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <path 
                  d="M 20 100 A 80 80 0 0 1 180 100" 
                  fill="none" 
                  stroke={scoreColor}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 251} 251`}
                  style={{ 
                    transition: 'stroke-dasharray 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    filter: `drop-shadow(0 0 12px ${scoreColor})`
                  }}
                />
              </svg>
              <div className="ai-gauge-content">
                <div className="ai-score-number" style={{ color: scoreColor }}>{score}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column - Analysis */}
        <div className="sentiment-analysis">
          <h3 className="analysis-headline">{aiAnalysis.headline}</h3>
          <p className="analysis-text">
            <HighlightedText text={aiAnalysis.analysis} />
          </p>
          <button className={`analysis-action-btn ${aiAnalysis.actionType}`}>
            {aiAnalysis.action}
          </button>
        </div>
      </div>

      {/* Bottom - Indicators */}
      <div className="sentiment-indicators">
        <div className="ai-indicator">
          <span className="indicator-label">VIX</span>
          <div className={`indicator-value ${vix?.signal === 'BULLISH' ? 'has-success' : vix?.signal?.includes('BEAR') ? 'has-danger' : ''}`}>
            {vix?.value ?? '--'}
          </div>
        </div>
        
        <div className="ai-indicator">
          <span className="indicator-label">F&G</span>
          <div className="indicator-value" style={{ color: (fearGreed?.score ?? 50) > 50 ? 'var(--accent-success)' : (fearGreed?.score ?? 50) < 40 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
            {fearGreed?.score ?? '--'}
          </div>
        </div>
        
        <div className="ai-indicator">
          <span className="indicator-label">Breadth</span>
          <div className={`indicator-value ${breadthPct >= 60 ? 'has-success' : breadthPct <= 40 ? 'has-danger' : ''}`}>
            {breadthPct}%
          </div>
        </div>
        
        <div className="ai-indicator">
          <span className="indicator-label">{ma?.ma_type || 'MA'}</span>
          <div className={`indicator-value ${(ma?.bullish_signals ?? 0) >= 4 ? 'has-success' : (ma?.bullish_signals ?? 0) <= 1 ? 'has-danger' : ''}`}>
            {ma?.bullish_signals ?? 0}<span style={{ fontSize: 11, opacity: 0.5 }}>/5</span>
          </div>
        </div>

        {indicators?.momentum && (
          <div className="ai-indicator">
            <span className="indicator-label">RSI</span>
            <div className={`indicator-value ${(indicators.momentum.rsi ?? 50) > 60 ? 'has-success' : (indicators.momentum.rsi ?? 50) < 40 ? 'has-danger' : ''}`}>
              {indicators.momentum.rsi?.toFixed(0) ?? '--'}
            </div>
          </div>
        )}

        {indicators?.dollar_index && (
          <div className="ai-indicator">
            <span className="indicator-label">DXY</span>
            <div className={`indicator-value ${indicators.dollar_index.signal === 'BULLISH' ? 'has-success' : indicators.dollar_index.signal === 'BEARISH' ? 'has-danger' : ''}`}>
              {indicators.dollar_index.value?.toFixed(1) ?? '--'}
            </div>
          </div>
        )}
      </div>

      {/* Yield Warning */}
      {yields?.inverted && (
        <div className="ai-yield-warning">
          <AlertTriangle size={14} />
          <span>{yieldWarning}</span>
        </div>
      )}
    </article>
  )
}
