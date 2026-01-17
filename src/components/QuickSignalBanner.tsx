'use client'

import { TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'

interface TopSignal {
    symbol: string
    action: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    hasEntry: boolean
}

export default function QuickSignalBanner() {
    const { watchlist, smcData } = useStore()
    const { language } = useTranslation()

    // Extract top signals from SMC data
    const topSignals: TopSignal[] = []
    let entryCount = 0
    let warningCount = 0
    let bullishCount = 0
    let bearishCount = 0

    for (const symbol of watchlist) {
        const stock = smcData?.stocks?.[symbol]
        if (!stock) continue

        // Count OB entries
        if (stock.alerts?.some((a: { type?: string }) => a.type?.startsWith('ob_entry_'))) {
            entryCount++
        }

        // Count warnings from trend prediction (NEW!)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tp = (stock as any).trend_prediction
        if (tp?.has_warning) {
            warningCount++
        }

        // Count trend predictions
        if (tp?.prediction === 'BULLISH' || tp?.prediction === 'STRONG_BULLISH') {
            bullishCount++
        } else if (tp?.prediction === 'BEARISH' || tp?.prediction === 'STRONG_BEARISH') {
            bearishCount++
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const positionScore = (stock as any).position_score

        if (positionScore?.action) {
            const action = positionScore.action.toUpperCase()
            let normalizedAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
            if (action === 'STRONG_BUY' || action === 'BUY') normalizedAction = 'BUY'
            else if (action === 'STRONG_SELL' || action === 'SELL') normalizedAction = 'SELL'

            topSignals.push({
                symbol,
                action: normalizedAction,
                confidence: positionScore.score || 50,
                hasEntry: stock.alerts?.some((a: { type?: string }) => a.type?.startsWith('ob_entry_'))
            })
        }
    }

    // Sort by entry first, then confidence
    topSignals.sort((a, b) => {
        if (a.hasEntry && !b.hasEntry) return -1
        if (!a.hasEntry && b.hasEntry) return 1
        return b.confidence - a.confidence
    })

    const buyCount = topSignals.filter(s => s.action === 'BUY').length
    const sellCount = topSignals.filter(s => s.action === 'SELL').length
    const top2 = topSignals.slice(0, 2)

    // No signals at all
    if (topSignals.length === 0) {
        return (
            <div className="quick-signal-banner muted">
                <AlertTriangle size={18} />
                <span>
                    {language === 'th'
                        ? 'ยังไม่มีสัญญาณ - เพิ่มหุ้นใน Watchlist'
                        : 'No signals - Add stocks to Watchlist'
                    }
                </span>
            </div>
        )
    }

    return (
        <div className={`quick-signal-banner ${entryCount > 0 ? 'has-entry' : ''} ${warningCount > 0 ? 'has-warning' : ''}`}>
            {/* Main message */}
            <div className="qsb-main">
                {entryCount > 0 ? (
                    <>
                        <Target size={18} className="entry-icon" />
                        <span className="qsb-text">
                            {language === 'th'
                                ? `${entryCount} หุ้นเข้าจุด!`
                                : `${entryCount} Entry Signal${entryCount > 1 ? 's' : ''}!`
                            }
                        </span>
                    </>
                ) : warningCount > 0 ? (
                    <>
                        <AlertTriangle size={18} className="warning-icon" />
                        <span className="qsb-text qsb-warning-text">
                            {language === 'th'
                                ? `⚠️ ${warningCount} หุ้นมีสัญญาณเตือน`
                                : `⚠️ ${warningCount} Stock${warningCount > 1 ? 's' : ''} with Warnings`
                            }
                        </span>
                    </>
                ) : (
                    <>
                        <span className="qsb-text">
                            {language === 'th' ? 'สัญญาณวันนี้:' : "Today's Signals:"}
                        </span>
                    </>
                )}

                <div className="qsb-counts">
                    <span className="qsb-count buy">
                        <TrendingUp size={12} /> {buyCount}
                    </span>
                    <span className="qsb-count sell">
                        <TrendingDown size={12} /> {sellCount}
                    </span>
                    {/* Warning count (NEW!) */}
                    {warningCount > 0 && (
                        <span className="qsb-count warning">
                            ⚠️ {warningCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Trend summary (NEW!) */}
            {(bullishCount > 0 || bearishCount > 0) && (
                <div className="qsb-trend-summary">
                    <span className="qsb-trend-label">{language === 'th' ? '1 เดือน:' : '1M:'}</span>
                    {bullishCount > 0 && <span className="qsb-trend bullish">🟢{bullishCount}</span>}
                    {bearishCount > 0 && <span className="qsb-trend bearish">🔴{bearishCount}</span>}
                </div>
            )}

            {/* Top signals preview */}
            {top2.length > 0 && (
                <div className="qsb-preview">
                    {top2.map(signal => (
                        <span
                            key={signal.symbol}
                            className={`qsb-chip ${signal.action.toLowerCase()}`}
                        >
                            {signal.symbol}
                            <span className="qsb-confidence">
                                {signal.action === 'BUY' ? '↑' : signal.action === 'SELL' ? '↓' : '–'}
                                {signal.confidence}%
                            </span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

