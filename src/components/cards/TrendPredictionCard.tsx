'use client'

import { TrendingUp, TrendingDown, AlertTriangle, Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '@/store/useStore'

interface TrendPrediction {
    score: number
    prediction: string
    prediction_th: string
    outlook: string
    confidence: number
    confidence_level: string
    bullish_factors: string[]
    bearish_factors: string[]
    warnings: string[]
    has_warning: boolean
    indicators: {
        adx: { value: number; strength: string; direction: string }
        macd: { divergence: { type: string | null; message: string | null } }
        linear_regression: { projected_change_pct: number; confidence: string }
        rsi: number
    }
}

export default function TrendPredictionCard() {
    const { watchlist, smcData } = useStore()
    const [expanded, setExpanded] = useState(false)

    // Collect all trend predictions
    const predictions: { symbol: string; data: TrendPrediction }[] = []
    const warnings: { symbol: string; message: string }[] = []

    for (const symbol of watchlist) {
        const stock = smcData?.stocks?.[symbol]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tp = (stock as any)?.trend_prediction as TrendPrediction
        if (tp && tp.prediction !== 'NO_DATA') {
            predictions.push({ symbol, data: tp })

            // Collect warnings
            if (tp.has_warning && tp.warnings) {
                for (const w of tp.warnings) {
                    warnings.push({ symbol, message: w })
                }
            }
        }
    }

    // Sort by most bearish first (for warnings)
    predictions.sort((a, b) => a.data.score - b.data.score)

    // Count by prediction type
    const bullishCount = predictions.filter(p =>
        p.data.prediction === 'BULLISH' || p.data.prediction === 'STRONG_BULLISH'
    ).length
    const bearishCount = predictions.filter(p =>
        p.data.prediction === 'BEARISH' || p.data.prediction === 'STRONG_BEARISH'
    ).length
    const neutralCount = predictions.filter(p => p.data.prediction === 'NEUTRAL').length

    // Get average score
    const avgScore = predictions.length > 0
        ? Math.round(predictions.reduce((sum, p) => sum + p.data.score, 0) / predictions.length)
        : 50

    // Get most bearish stocks
    const bearishStocks = predictions
        .filter(p => p.data.prediction === 'BEARISH' || p.data.prediction === 'STRONG_BEARISH')
        .slice(0, 3)

    // Get overall market verdict
    const getVerdict = () => {
        if (avgScore >= 60) return { text: 'ตลาดมีแนวโน้มดี', color: '#10b981', icon: TrendingUp }
        if (avgScore <= 40) return { text: 'ตลาดมีแนวโน้มลง', color: '#ef4444', icon: TrendingDown }
        return { text: 'ตลาดไม่ชัดเจน', color: '#f59e0b', icon: Activity }
    }

    const verdict = getVerdict()

    if (predictions.length === 0) {
        return null // Don't show if no data
    }

    return (
        <article className="card trend-prediction-card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📊 แนวโน้ม 1 เดือน</span>
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 4
                    }}
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {/* Summary Section */}
            <div className="tp-summary">
                <div className="tp-score" style={{ '--score-color': verdict.color } as React.CSSProperties}>
                    <div className="tp-score-number">{avgScore}</div>
                    <div className="tp-score-label">คะแนนเฉลี่ย</div>
                </div>

                <div className="tp-verdict">
                    <verdict.icon size={20} style={{ color: verdict.color }} />
                    <span style={{ color: verdict.color, fontWeight: 600 }}>{verdict.text}</span>
                </div>

                <div className="tp-counts">
                    <span className="tp-count bullish">
                        <TrendingUp size={12} /> {bullishCount} ขาขึ้น
                    </span>
                    <span className="tp-count neutral">
                        {neutralCount} ทรงตัว
                    </span>
                    <span className="tp-count bearish">
                        <TrendingDown size={12} /> {bearishCount} ขาลง
                    </span>
                </div>
            </div>

            {/* Warnings Section */}
            {warnings.length > 0 && (
                <div className="tp-warnings">
                    <div className="tp-warning-title">
                        <AlertTriangle size={14} />
                        สัญญาณเตือน ({warnings.length})
                    </div>
                    {warnings.slice(0, 3).map((w, i) => (
                        <div key={i} className="tp-warning-item">
                            <span className="tp-warning-symbol">{w.symbol}</span>
                            <span className="tp-warning-msg">{w.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Bearish Stocks */}
            {bearishStocks.length > 0 && (
                <div className="tp-bearish-section">
                    <div className="tp-section-title">⚠️ ระวังหุ้นเหล่านี้</div>
                    {bearishStocks.map(({ symbol, data }) => (
                        <div key={symbol} className="tp-stock-item bearish">
                            <span className="tp-stock-symbol">{symbol}</span>
                            <span className="tp-stock-prediction">{data.prediction_th}</span>
                            <span className="tp-stock-score">{data.score}/100</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Expanded Details */}
            {expanded && (
                <div className="tp-expanded">
                    <div className="tp-section-title">รายละเอียดทั้งหมด</div>
                    {predictions.map(({ symbol, data }) => (
                        <div key={symbol} className={`tp-detail-item ${data.prediction.toLowerCase()}`}>
                            <div className="tp-detail-header">
                                <span className="tp-stock-symbol">{symbol}</span>
                                <span className={`tp-badge ${data.prediction.toLowerCase()}`}>
                                    {data.prediction_th}
                                </span>
                            </div>
                            <div className="tp-detail-outlook">{data.outlook}</div>
                            {data.bullish_factors.length > 0 && (
                                <div className="tp-factors bullish">
                                    {data.bullish_factors.slice(0, 2).map((f, i) => (
                                        <div key={i} className="tp-factor">✓ {f}</div>
                                    ))}
                                </div>
                            )}
                            {data.bearish_factors.length > 0 && (
                                <div className="tp-factors bearish">
                                    {data.bearish_factors.slice(0, 2).map((f, i) => (
                                        <div key={i} className="tp-factor">✗ {f}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </article>
    )
}
