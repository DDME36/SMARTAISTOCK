'use client'

import { LayoutGrid, List, Bell, Settings } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'

type View = 'dashboard' | 'watchlist' | 'alerts' | 'settings'

const navItems: { view: View; icon: typeof LayoutGrid }[] = [
  { view: 'dashboard', icon: LayoutGrid },
  { view: 'watchlist', icon: List },
  { view: 'alerts', icon: Bell },
  { view: 'settings', icon: Settings }
]

export default function BottomNav() {
  const { activeView, setActiveView } = useStore()
  const [itemSize, setItemSize] = useState(48) // 44px button + 4px gap
  
  // Adjust for mobile
  useEffect(() => {
    const updateSize = () => {
      if (window.innerWidth <= 480) {
        setItemSize(42) // 40px button + 2px gap
      } else {
        setItemSize(48) // 44px button + 4px gap
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  
  const activeIndex = navItems.findIndex(item => item.view === activeView)

  return (
    <nav className="bottom-nav">
      {/* Sliding indicator */}
      <div 
        className="nav-indicator"
        style={{ 
          transform: `translateX(${activeIndex * itemSize}px)` 
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
