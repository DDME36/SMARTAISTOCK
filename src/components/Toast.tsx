'use client'

import { useStore } from '@/store/useStore'

export default function Toast() {
  const { toast } = useStore()

  return (
    <div className={`toast ${toast.visible ? 'visible' : ''}`}>
      {toast.message}
    </div>
  )
}
