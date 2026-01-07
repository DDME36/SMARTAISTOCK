'use client'

import { useStore } from '@/store/useStore'
import { translations } from '@/lib/translations'

export function useTranslation() {
  const language = useStore((state) => state.language)
  
  const t = (key: string): string => {
    return translations[language][key] || key
  }
  
  return { t, language }
}
