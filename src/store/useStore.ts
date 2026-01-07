'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SMCData, Language, Theme } from '@/types'
import { getThemeByTime } from '@/lib/utils'

interface AppState {
  // Data
  watchlist: string[]
  smcData: SMCData | null
  
  // UI
  language: Language
  theme: Theme
  activeView: 'dashboard' | 'watchlist' | 'alerts' | 'settings'
  toast: { message: string; visible: boolean }
  
  // Actions
  addSymbol: (symbol: string) => void
  removeSymbol: (symbol: string) => void
  setSmcData: (data: SMCData) => void
  setLanguage: (lang: Language) => void
  setTheme: (theme: Theme) => void
  setActiveView: (view: AppState['activeView']) => void
  showToast: (message: string) => void
  hideToast: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      watchlist: [],
      smcData: null,
      language: 'en',
      theme: getThemeByTime(),
      activeView: 'dashboard',
      toast: { message: '', visible: false },
      
      // Actions
      addSymbol: (symbol) => {
        const { watchlist } = get()
        if (!watchlist.includes(symbol.toUpperCase())) {
          set({ watchlist: [...watchlist, symbol.toUpperCase()] })
        }
      },
      
      removeSymbol: (symbol) => {
        set({ watchlist: get().watchlist.filter(s => s !== symbol) })
      },
      
      setSmcData: (data) => set({ smcData: data }),
      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme }),
      setActiveView: (view) => set({ activeView: view }),
      
      showToast: (message) => {
        set({ toast: { message, visible: true } })
        setTimeout(() => get().hideToast(), 3000)
      },
      
      hideToast: () => set({ toast: { message: '', visible: false } })
    }),
    {
      name: 'smc-alert-storage',
      partialize: (state) => ({
        watchlist: state.watchlist,
        language: state.language
      })
    }
  )
)
