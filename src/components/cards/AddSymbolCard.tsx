'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Loader2, AlertCircle, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/hooks/useTranslation'
import { validateSymbol } from '@/lib/utils'

// Popular symbols for auto-complete
const POPULAR_SYMBOLS = [
  // Tech Giants
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AMD', name: 'AMD Inc.' },
  { symbol: 'INTC', name: 'Intel Corp.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corp.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'CSCO', name: 'Cisco Systems' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'TXN', name: 'Texas Instruments' },
  { symbol: 'IBM', name: 'IBM Corp.' },
  { symbol: 'NOW', name: 'ServiceNow Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies' },
  
  // Growth & Meme Stocks
  { symbol: 'PLTR', name: 'Palantir Tech' },
  { symbol: 'COIN', name: 'Coinbase Global' },
  { symbol: 'SOFI', name: 'SoFi Technologies' },
  { symbol: 'RKLB', name: 'Rocket Lab USA' },
  { symbol: 'HOOD', name: 'Robinhood Markets' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'CRWD', name: 'CrowdStrike' },
  { symbol: 'DKNG', name: 'DraftKings Inc.' },
  { symbol: 'SQ', name: 'Block Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'ROKU', name: 'Roku Inc.' },
  { symbol: 'SNAP', name: 'Snap Inc.' },
  { symbol: 'PINS', name: 'Pinterest Inc.' },
  { symbol: 'SPOT', name: 'Spotify' },
  { symbol: 'ZM', name: 'Zoom Video' },
  { symbol: 'DOCU', name: 'DocuSign Inc.' },
  { symbol: 'U', name: 'Unity Software' },
  { symbol: 'RBLX', name: 'Roblox Corp.' },
  { symbol: 'PATH', name: 'UiPath Inc.' },
  { symbol: 'AFRM', name: 'Affirm Holdings' },
  
  // EV & Clean Energy
  { symbol: 'NIO', name: 'NIO Inc.' },
  { symbol: 'RIVN', name: 'Rivian Automotive' },
  { symbol: 'LCID', name: 'Lucid Group' },
  { symbol: 'XPEV', name: 'XPeng Inc.' },
  { symbol: 'LI', name: 'Li Auto Inc.' },
  { symbol: 'F', name: 'Ford Motor' },
  { symbol: 'GM', name: 'General Motors' },
  { symbol: 'EOSE', name: 'Eos Energy' },
  { symbol: 'PLUG', name: 'Plug Power' },
  { symbol: 'FSLR', name: 'First Solar' },
  { symbol: 'ENPH', name: 'Enphase Energy' },
  { symbol: 'SEDG', name: 'SolarEdge Tech' },
  
  // AI & Quantum
  { symbol: 'IONQ', name: 'IonQ Inc.' },
  { symbol: 'RGTI', name: 'Rigetti Computing' },
  { symbol: 'AI', name: 'C3.ai Inc.' },
  { symbol: 'BBAI', name: 'BigBear.ai' },
  { symbol: 'SOUN', name: 'SoundHound AI' },
  { symbol: 'UPST', name: 'Upstart Holdings' },
  
  // Aerospace & Defense
  { symbol: 'ACHR', name: 'Archer Aviation' },
  { symbol: 'JOBY', name: 'Joby Aviation' },
  { symbol: 'BA', name: 'Boeing Co.' },
  { symbol: 'LMT', name: 'Lockheed Martin' },
  { symbol: 'RTX', name: 'RTX Corp.' },
  { symbol: 'NOC', name: 'Northrop Grumman' },
  { symbol: 'GD', name: 'General Dynamics' },
  { symbol: 'SPCE', name: 'Virgin Galactic' },
  
  // Finance & Banks
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'BAC', name: 'Bank of America' },
  { symbol: 'WFC', name: 'Wells Fargo' },
  { symbol: 'GS', name: 'Goldman Sachs' },
  { symbol: 'MS', name: 'Morgan Stanley' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings' },
  { symbol: 'AXP', name: 'American Express' },
  { symbol: 'BLK', name: 'BlackRock Inc.' },
  { symbol: 'SCHW', name: 'Charles Schwab' },
  
  // Healthcare & Pharma
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'UNH', name: 'UnitedHealth' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'MRK', name: 'Merck & Co.' },
  { symbol: 'LLY', name: 'Eli Lilly' },
  { symbol: 'TMO', name: 'Thermo Fisher' },
  { symbol: 'ABT', name: 'Abbott Labs' },
  { symbol: 'BMY', name: 'Bristol-Myers' },
  { symbol: 'AMGN', name: 'Amgen Inc.' },
  { symbol: 'GILD', name: 'Gilead Sciences' },
  { symbol: 'MRNA', name: 'Moderna Inc.' },
  { symbol: 'BNTX', name: 'BioNTech SE' },
  
  // Consumer & Retail
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale' },
  { symbol: 'HD', name: 'Home Depot' },
  { symbol: 'TGT', name: 'Target Corp.' },
  { symbol: 'LOW', name: 'Lowes Companies' },
  { symbol: 'NKE', name: 'Nike Inc.' },
  { symbol: 'SBUX', name: 'Starbucks Corp.' },
  { symbol: 'MCD', name: 'McDonalds Corp.' },
  { symbol: 'KO', name: 'Coca-Cola Co.' },
  { symbol: 'PEP', name: 'PepsiCo Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'DIS', name: 'Walt Disney' },
  
  // Energy & Oil
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'CVX', name: 'Chevron Corp.' },
  { symbol: 'COP', name: 'ConocoPhillips' },
  { symbol: 'OXY', name: 'Occidental Petro' },
  { symbol: 'SLB', name: 'Schlumberger' },
  
  // ETFs
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'IWM', name: 'Russell 2000 ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF' },
  { symbol: 'ARKK', name: 'ARK Innovation' },
  { symbol: 'ARKG', name: 'ARK Genomic' },
  { symbol: 'SOXL', name: 'Semicon Bull 3X' },
  { symbol: 'TQQQ', name: 'Nasdaq Bull 3X' },
  { symbol: 'SQQQ', name: 'Nasdaq Bear 3X' },
  { symbol: 'VTI', name: 'Total Stock ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500' },
  
  // Crypto
  { symbol: 'BTC-USD', name: 'Bitcoin' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'SOL-USD', name: 'Solana' },
  { symbol: 'XRP-USD', name: 'Ripple' },
  { symbol: 'DOGE-USD', name: 'Dogecoin' },
  { symbol: 'ADA-USD', name: 'Cardano' },
  { symbol: 'AVAX-USD', name: 'Avalanche' },
  { symbol: 'DOT-USD', name: 'Polkadot' },
  { symbol: 'MATIC-USD', name: 'Polygon' },
  { symbol: 'LINK-USD', name: 'Chainlink' },
  { symbol: 'SHIB-USD', name: 'Shiba Inu' },
  { symbol: 'LTC-USD', name: 'Litecoin' },
  { symbol: 'UNI-USD', name: 'Uniswap' },
  { symbol: 'ATOM-USD', name: 'Cosmos' },
  { symbol: 'APT-USD', name: 'Aptos' },
  { symbol: 'ARB-USD', name: 'Arbitrum' },
  { symbol: 'OP-USD', name: 'Optimism' },
  { symbol: 'SUI-USD', name: 'Sui' },
  { symbol: 'PEPE-USD', name: 'Pepe' },
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
  const [mounted, setMounted] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number>(0)
  const isTouchMove = useRef<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter suggestions
  useEffect(() => {
    if (input.length >= 1) {
      const filtered = POPULAR_SYMBOLS.filter(s => 
        (s.symbol.includes(input) || s.name.toLowerCase().includes(input.toLowerCase())) &&
        !watchlist.includes(s.symbol)
      ).slice(0, 8)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
    setSelectedIndex(-1)
  }, [input, watchlist])

  // Update position when showing
  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [])

  // Position update on show
  useEffect(() => {
    if (showSuggestions) {
      updatePosition()
    }
  }, [showSuggestions, updatePosition])

  // Click outside to close
  useEffect(() => {
    if (!showSuggestions) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        inputRef.current && !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false)
      }
    }

    // Delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

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
      case 'not_found': return <Search size={14} />
      default: return <AlertCircle size={14} />
    }
  }

  // Dropdown content
  const dropdownContent = showSuggestions && suggestions.length > 0 && (
    <div 
      ref={dropdownRef}
      className="suggestions-dropdown"
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }}
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0].clientY
        isTouchMove.current = false
      }}
      onTouchMove={() => {
        isTouchMove.current = true
      }}
    >
      {suggestions.map((s, idx) => {
        const logoUrl = `https://assets.parqet.com/logos/symbol/${s.symbol}?format=png`
        return (
          <div
            key={s.symbol}
            className={`suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
            onClick={() => handleAdd(s.symbol)}
            onTouchEnd={(e) => {
              // Only select if it was a tap, not a scroll
              if (!isTouchMove.current) {
                e.preventDefault()
                handleAdd(s.symbol)
              }
            }}
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
  )

  return (
    <article className="card">
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
          onFocus={() => {
            if (suggestions.length > 0) {
              updatePosition()
              setShowSuggestions(true)
            }
          }}
        />
        <Plus className="input-icon" size={18} />
      </div>

      {/* Portal dropdown */}
      {mounted && dropdownContent && createPortal(dropdownContent, document.body)}
      
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
      
      {error && (
        <div className="add-error">
          {getErrorIcon()}
          <span>{error}</span>
          {errorType === 'not_found' && (
            <div className="error-hint">{t('try_symbols')}</div>
          )}
        </div>
      )}
      
      {!error && watchlist.length === 0 && (
        <div className="add-hint">💡 {t('add_hint')}</div>
      )}
    </article>
  )
}
