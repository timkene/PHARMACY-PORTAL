'use client'
import { useEffect } from 'react'

const DISMISS_DELAY_MS = 4000

interface ToastProps {
  message: string
  type?: 'error' | 'success'
  onDismiss: () => void
}

export function Toast({ message, type = 'error', onDismiss }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, DISMISS_DELAY_MS)
    return () => clearTimeout(id)
  }, [onDismiss])

  const bg = type === 'error' ? 'bg-error' : 'bg-secondary'

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 ${bg} text-white px-4 py-3 rounded shadow-lg max-w-sm`}>
      <p className="text-body-sm flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-white/70 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
