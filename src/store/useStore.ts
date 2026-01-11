'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SMCData, Language, Theme } from '@/types'
import { getThemeByTime } from '@/lib/utils'

interface OnDemandSMC {
  symbol: string
  current_price: number
  trend: 'bullish' | 'bearish' | 'neutral'
  order_blocks: any[]
  alerts: { type: string; message: string; price: number }[]
  support: number | null
  resistance: number | null
  price_target: number | null
  stop_loss: number | null
  generated_at: string
}

interface AppState {
  // Data
  watchlist: string[]
  smcData: SMCData | null
  onDemandSMC: Record<string, OnDemandSMC>
  loadingSMC: Record<string, boolean>
  isLoading: boolean
  
  // UI
  language: Language
  theme: Theme
  activeView: 'dashboard' | 'watchlist' | 'alerts' | 'settings'
  toast: { message: string; visible: boolean }
  
  // Actions
  setWatchlist: (watchlist: string[]) => void
  addSymbol: (symbol: string) => Promise<void>
  removeSymbol: (symbol: string) => Promise<void>
  setSmcData: (data: SMCData) => void
  setLanguage: (lang: Language) => void
  setTheme: (theme: Theme) => void
  setActiveView: (view: AppState['activeView']) => void
  showToast: (message: string) => void
  hideToast: () => void
  fetchOnDemandSMC: (symbol: string) => Promise<void>
  setIsLoading: (loading: boolean) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      watchlist: [],
      smcData: null,
      onDemandSMC: {},
      loadingSMC: {},
      isLoading: false,
      language: 'en',
      theme: getThemeByTime(),
      activeView: 'dashboard',
      toast: { message: '', visible: false },
      
      // Actions
      setWatchlist: (watchlist) => set({ watchlist }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      addSymbol: async (symbol) => {
        const { watchlist } = get()
        const upperSymbol = symbol.toUpperCase()
        if (watchlist.includes(upperSymbol)) return
        
        // Optimistic update
        set({ watchlist: [...watchlist, upperSymbol] })
        
        // Sync to database
        try {
          const res = await fetch('/api/user/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: upperSymbol })
          })
          if (res.ok) {
            const data = await res.json()
            set({ watchlist: data.watchlist })
          }
        } catch {
          // Revert on error
          set({ watchlist })
        }
        
        // Auto-fetch SMC for new symbol
        get().fetchOnDemandSMC(upperSymbol)
      },
      
      removeSymbol: async (symbol) => {
        const { watchlist } = get()
        const upperSymbol = symbol.toUpperCase()
        
        // Optimistic update
        set({ watchlist: watchlist.filter(s => s !== upperSymbol) })
        
        // Sync to database
        try {
          const res = await fetch('/api/user/watchlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: upperSymbol })
          })
          if (res.ok) {
            const data = await res.json()
            set({ watchlist: data.watchlist })
          }
        } catch {
          // Revert on error
          set({ watchlist })
        }
      },
      
      setSmcData: (data) => set({ smcData: data }),
      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme }),
      setActiveView: (view) => set({ activeView: view }),
      
      showToast: (message) => {
        set({ toast: { message, visible: true } })
        setTimeout(() => get().hideToast(), 3000)
      },
      
      hideToast: () => set({ toast: { message: '', visible: false } }),
      
      fetchOnDemandSMC: async (symbol) => {
        const { smcData, onDemandSMC, loadingSMC } = get()
        
        // Skip if already in pre-calculated data
        if (smcData?.stocks?.[symbol]) return
        
        // Skip if already loading or recently fetched (< 5 min)
        if (loadingSMC[symbol]) return
        const existing = onDemandSMC[symbol]
        if (existing) {
          const age = Date.now() - new Date(existing.generated_at).getTime()
          if (age < 300000) return // 5 min cache
        }
        
        set({ loadingSMC: { ...get().loadingSMC, [symbol]: true } })
        
        try {
          const res = await fetch(`/api/smc?symbol=${symbol}&interval=1h`)
          if (res.ok) {
            const data = await res.json()
            set({ 
              onDemandSMC: { ...get().onDemandSMC, [symbol]: data },
              loadingSMC: { ...get().loadingSMC, [symbol]: false }
            })
          } else {
            set({ loadingSMC: { ...get().loadingSMC, [symbol]: false } })
          }
        } catch {
          set({ loadingSMC: { ...get().loadingSMC, [symbol]: false } })
        }
      }
    }),
    {
      name: 'blockhunter-storage',
      partialize: (state) => ({
        language: state.language
      })
    }
  )
)
