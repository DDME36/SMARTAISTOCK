'use client'

import { create } from 'zustand'
import { useStore } from './useStore'

interface User {
  id: number
  username: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Actions
  setUser: (user: User | null) => void
  login: (username: string, password: string) => Promise<{ error?: string }>
  register: (username: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false 
  }),
  
  login: async (username, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { error: data.error || 'Login failed' }
      }
      
      set({ user: data.user, isAuthenticated: true })
      
      // Load watchlist from DB
      const watchlistRes = await fetch('/api/user/watchlist')
      if (watchlistRes.ok) {
        const wlData = await watchlistRes.json()
        useStore.getState().setWatchlist(wlData.watchlist || [])
      }
      
      return {}
    } catch {
      return { error: 'Network error' }
    }
  },
  
  register: async (username, password) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        return { error: data.error || 'Registration failed' }
      }
      
      set({ user: data.user, isAuthenticated: true })
      useStore.getState().setWatchlist([])
      
      return {}
    } catch {
      return { error: 'Network error' }
    }
  },
  
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    set({ user: null, isAuthenticated: false })
    useStore.getState().setWatchlist([])
  },
  
  checkAuth: async () => {
    try {
      set({ isLoading: true })
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      
      if (data.user) {
        set({ user: data.user, isAuthenticated: true, isLoading: false })
        // Load watchlist from DB
        useStore.getState().setWatchlist(data.watchlist || [])
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  }
}))
