'use client'

import { useState } from 'react'
import { Plus, Loader2, AlertCircle, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { validateSymbol } from '@/lib/utils'

export default function AddSymbolCard() {
  const { watchlist, addSymbol, showToast } = useStore()
  const { t } = useTranslation()
  
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<'not_found' | 'duplicate' | 'empty' | ''>('')

  const handleAdd = async () => {
    const symbol = input.toUpperCase().trim()
    setError('')
    setErrorType('')
    
    if (!symbol) {
      setError(t('please_enter_symbol'))
      setErrorType('empty')
      return
    }
    
    if (watchlist.includes(symbol)) {
      setError(t('already_in_list'))
      setErrorType('duplicate')
      return
    }
    
    setLoading(true)
    
    // Small delay for UX
    await new Promise(r => setTimeout(r, 500))
    
    const result = await validateSymbol(symbol)
    setLoading(false)
    
    if (!result.valid) {
      setError(`"${symbol}" ${t('symbol_not_found')}`)
      setErrorType('not_found')
      return
    }
    
    addSymbol(symbol)
    setInput('')
    showToast(`${t('added')} ${symbol}`)
  }

  const getErrorIcon = () => {
    switch (errorType) {
      case 'not_found':
        return <Search size={14} />
      case 'duplicate':
        return <AlertCircle size={14} />
      default:
        return <AlertCircle size={14} />
    }
  }

  return (
    <article className="card">
      <div className="card-title">{t('add_symbol')}</div>
      
      <div className="add-input-wrapper">
        <input
          type="text"
          className={`add-input ${error ? 'error' : ''}`}
          placeholder="AAPL, TSLA, BTC-USD..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase())
            setError('')
            setErrorType('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Plus className="input-icon" size={18} />
      </div>
      
      <button 
        className={`btn btn-primary ${loading ? 'processing' : ''}`}
        onClick={handleAdd}
        disabled={loading}
        style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="icon-spin" /> {t('checking')}
          </>
        ) : (
          t('add_to_watchlist')
        )}
      </button>
      
      {/* Error Message */}
      {error && (
        <div className="add-error">
          {getErrorIcon()}
          <span>{error}</span>
          {errorType === 'not_found' && (
            <div className="error-hint">
              {t('try_symbols')}
            </div>
          )}
        </div>
      )}
      
      {/* Empty state hint */}
      {!error && watchlist.length === 0 && (
        <div className="add-hint">
          💡 {t('add_hint')}
        </div>
      )}
    </article>
  )
}
