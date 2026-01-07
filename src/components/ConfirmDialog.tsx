'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const Icon = variant === 'danger' ? Trash2 : AlertTriangle

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div 
        ref={dialogRef}
        className={`confirm-dialog ${variant}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button className="confirm-close" onClick={onCancel}>
          <X size={18} />
        </button>
        
        <div className={`confirm-icon ${variant}`}>
          <Icon size={24} />
        </div>
        
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        
        <div className="confirm-actions">
          <button className="btn confirm-cancel" onClick={onCancel}>
            {cancelText || t('cancel')}
          </button>
          <button 
            className={`btn confirm-btn ${variant}`}
            onClick={onConfirm}
          >
            {confirmText || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
