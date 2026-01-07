'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

export default function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { language } = useStore()
  
  useEffect(() => {
    // Update body class based on language
    document.body.classList.remove('lang-en', 'lang-th')
    document.body.classList.add(`lang-${language}`)
    
    // Update html lang attribute
    document.documentElement.lang = language
  }, [language])
  
  return <>{children}</>
}
