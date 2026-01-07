'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Loader2, AlertCircle, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { validateSymbol } from '@/lib/utils'

// Popular symbols for auto-complete
const POPULAR_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'AMD', name: 'AMD Inc.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'RKLB', name: 'Rocket Lab USA' },
  { symbol: 'EOSE', name: 'Eos Energy' },
  { symbol: 'PLTR', name: 'Palantir Tech' },
  { symbol: 'COIN', name: 'Coinbase Global' },
  { symbol: 'SOFI', name: 'SoFi Technologies' },
  { symbol: 'NIO', name: 'NIO Inc.' },
  { symbol: 'RIVN', name: 'Rivian Automotive' },
  { symbol: 'LCID', name: 'Lucid Group' },
  { symbol: 'ACHR', name: 'Archer Aviation' },
  { symbol: 'IONQ', name: 'IonQ Inc.' },
  { symbol: 'RGTI', name: 'Rigetti Computing' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'SOL-USD', name: 'Solana' },
  { symbol: 'XRP-USD', name: 'Ripple' },
  { symbol: 'DOGE-USD', name: 'Dogecoin' },
]

export default function AddSymbolCard() {
  const { watchlist, addSymbol, showToast } = useStore()
  const { t } = useTranslation()
  
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<'not_found' | 'duplicate' | 'empty' | ''>('')
  const [suggestions, setSuggestions] = useState<typeof POPULAR_SYMBOLS>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input
  useEffect(() => {
    if (input.length >= 1) {
      const filtered = POPULAR_SYMBOLS.filter(s => 
        (s.symbol.includes(input) || s.name.toLowerCase().includes(input.toLowerCase())) &&
        !watchlist.includes(s.symbol)
      ).slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
    setSelectedIndex(-1)
  }, [input, watchlist])

  // Update dropdown position
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }

  // Track position on scroll/resize
  useEffect(() => {
    if (!showSuggestions) return
    
    updateDropdownPosition()
    
    const handleScroll = () => updateDropdownPosition()
    const handleResize = () => updateDropdownPosition()
    
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [showSuggestions])

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAdd = async (symbolToAdd?: string) => {
    const symbol = (symbolToAdd || input).toUpperCase().trim()
    setError('')
    setErrorType('')
    setShowSuggestions(false)
    
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleAdd()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0) {
        handleAdd(suggestions[selectedIndex].symbol)
      } else {
        handleAdd()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
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
    <article className={`card ${showSuggestions ? 'has-dropdown' : ''}`}>
      <div className="card-title">{t('add_symbol')}</div>
      
      <div className="add-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className={`add-input ${error ? 'error' : ''}`}
          placeholder="AAPL, TSLA, BTC-USD..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase())
            setError('')
            setErrorType('')
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => input.length >= 1 && suggestions.length > 0 && setShowSuggestions(true)}
        />
        <Plus className="input-icon" size={18} />
        
        {/* Auto-complete suggestions - Fixed position */}
        {showSuggestions && (
          <div 
            className="suggestions-dropdown" 
            ref={suggestionsRef}
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
          >
            {suggestions.map((s, idx) => {
              const logoUrl = `https://assets.parqet.com/logos/symbol/${s.symbol}?format=png`
              return (
                <div
                  key={s.symbol}
                  className={`suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleAdd(s.symbol)}
                >
                  <div className="suggestion-logo-wrap">
                    <img 
                      src={logoUrl} 
                      alt={s.symbol}
                      className="suggestion-logo"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                    <div className="suggestion-logo-fallback">
                      {s.symbol.substring(0, 2)}
                    </div>
                  </div>
                  <span className="suggestion-symbol">{s.symbol}</span>
                  <span className="suggestion-name">{s.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      <button 
        className={`btn btn-primary ${loading ? 'processing' : ''}`}
        onClick={() => handleAdd()}
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
