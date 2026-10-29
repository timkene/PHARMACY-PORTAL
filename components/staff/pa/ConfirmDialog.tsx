'use client'
import { useEffect, useRef } from 'react'
import { BUTTON } from './PreparationShared'

export function ConfirmDialog({ title, description, confirmLabel, busy, onCancel, onConfirm }: {
  title: string; description: string; confirmLabel: string; busy: boolean
  onCancel: () => void; onConfirm: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancel.current?.focus() }, [])
  return <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
    <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"
      className="bg-surface-lowest p-6 rounded max-w-lg space-y-4" onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel() }
        if (event.key === 'Tab' && !busy) {
          if (event.shiftKey && document.activeElement === cancel.current) { event.preventDefault(); confirm.current?.focus() }
          else if (!event.shiftKey && document.activeElement === confirm.current) { event.preventDefault(); cancel.current?.focus() }
        }
      }}>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <button ref={cancel} className={BUTTON} disabled={busy} onClick={onCancel}>Cancel</button>{' '}
      <button ref={confirm} className={BUTTON} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
    </section>
  </div>
}
