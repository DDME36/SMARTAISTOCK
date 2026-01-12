'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './ConfirmDialog.module.css'

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
  
  const iconClass = `${styles.icon} ${
    variant === 'warning' ? styles.iconWarning : 
    variant === 'default' ? styles.iconDefault : ''
  }`
  
  const confirmBtnClass = `${styles.confirmBtn} ${
    variant === 'warning' ? styles.confirmBtnWarning : 
    variant === 'default' ? styles.confirmBtnDefault : ''
  }`

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div 
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <button className={styles.closeBtn} onClick={onCancel}>
          <X size={18} />
        </button>
        
        <div className={iconClass}>
          <Icon size={24} />
        </div>
        
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelText || t('cancel')}
          </button>
          <button 
            className={confirmBtnClass}
            onClick={onConfirm}
          >
            {confirmText || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
