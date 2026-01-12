'use client'

import { LayoutGrid, List, Bell, Settings } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type View = 'dashboard' | 'watchlist' | 'alerts' | 'settings'

const navItems: { view: View; icon: typeof LayoutGrid }[] = [
  { view: 'dashboard', icon: LayoutGrid },
  { view: 'watchlist', icon: List },
  { view: 'alerts', icon: Bell },
  { view: 'settings', icon: Settings }
]

export default function BottomNav() {
  const { activeView, setActiveView } = useStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [itemSize, setItemSize] = useState(48) // 44px button + 4px gap
  
  // Sync URL with activeView on mount and URL changes
  useEffect(() => {
    const viewFromUrl = searchParams.get('view') as View | null
    if (viewFromUrl && navItems.some(item => item.view === viewFromUrl)) {
      if (viewFromUrl !== activeView) {
        setActiveView(viewFromUrl)
      }
    }
  }, [searchParams, setActiveView, activeView])
  
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
  
  const handleNavClick = (view: View) => {
    setActiveView(view)
    // Update URL without full page reload (enables back button)
    const url = view === 'dashboard' ? '/' : `/?view=${view}`
    router.push(url, { scroll: false })
  }
  
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
          onClick={() => handleNavClick(view)}
        >
          <Icon size={20} strokeWidth={activeView === view ? 2.5 : 2} />
        </button>
      ))}
    </nav>
  )
}
