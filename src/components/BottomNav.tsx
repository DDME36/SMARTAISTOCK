'use client'

import { LayoutGrid, List, Bell, Settings } from 'lucide-react'
import { useStore } from '@/store/useStore'

type View = 'dashboard' | 'watchlist' | 'alerts' | 'settings'

const navItems: { view: View; icon: typeof LayoutGrid }[] = [
  { view: 'dashboard', icon: LayoutGrid },
  { view: 'watchlist', icon: List },
  { view: 'alerts', icon: Bell },
  { view: 'settings', icon: Settings }
]

export default function BottomNav() {
  const { activeView, setActiveView } = useStore()
  
  // Calculate indicator position (44px button + 4px gap = 48px per item)
  const activeIndex = navItems.findIndex(item => item.view === activeView)

  return (
    <nav className="bottom-nav">
      {/* Sliding pink indicator */}
      <div 
        className="nav-indicator"
        style={{ 
          transform: `translateX(${activeIndex * 48}px)` 
        }}
      />
      
      {navItems.map(({ view, icon: Icon }) => (
        <button
          key={view}
          className={`nav-item ${activeView === view ? 'active' : ''}`}
          onClick={() => setActiveView(view)}
        >
          <Icon size={20} strokeWidth={activeView === view ? 2.5 : 2} />
        </button>
      ))}
    </nav>
  )
}
