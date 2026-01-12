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
  const [navConfig, setNavConfig] = useState({ buttonSize: 44, gap: 4, padding: 8 })
  
  // Adjust for mobile - match CSS media queries
  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isLandscape = width > height
      
      if (isLandscape && height <= 500) {
        // Landscape mode
        setNavConfig({ buttonSize: 36, gap: 4, padding: 4 })
      } else if (width <= 480) {
        // Mobile portrait
        setNavConfig({ buttonSize: 40, gap: 2, padding: 6 })
      } else {
        // Desktop
        setNavConfig({ buttonSize: 44, gap: 4, padding: 8 })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  
  const handleNavClick = (view: View) => {
    setActiveView(view)
    // Update URL without full page reload (enables back button)
    const url = view === 'dashboard' ? '/' : `/?view=${view}`
    window.history.pushState({}, '', url)
  }
  
  const activeIndex = navItems.findIndex(item => item.view === activeView)
  
  // Calculate translateX: each item takes buttonSize + gap
  const translateX = activeIndex * (navConfig.buttonSize + navConfig.gap)

  return (
    <nav className="bottom-nav">
      {/* Sliding indicator */}
      <div 
        className="nav-indicator"
        style={{ 
          transform: `translateX(${translateX}px)` 
        }}
      />
      
      {navItems.map(({ view, icon: Icon }) => (
        <button
          key={view}
          className={`nav-item ${activeView === view ? 'active' : ''}`}
          onClick={() => handleNavClick(view)}
        >
          <Icon size={20} strokeWidth={activeView === view ? 2.5 : 2} />
        </button>
      ))}
    </nav>
  )
}
