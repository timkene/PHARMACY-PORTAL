'use client'
import { useEffect, useRef } from 'react'
import { BUTTON } from './PreparationShared'
export function CloseBatchDialog({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancel.current?.focus() }, [])
  return <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
    <section role="alertdialog" aria-modal="true" aria-labelledby="close-batch-title" aria-describedby="close-batch-description"
      className="bg-surface-lowest p-6 rounded max-w-lg space-y-4" onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel() }
        if (event.key === 'Tab' && !busy) {
          if (event.shiftKey && document.activeElement === cancel.current) { event.preventDefault(); confirm.current?.focus() }
          else if (!event.shiftKey && document.activeElement === confirm.current) { event.preventDefault(); cancel.current?.focus() }
        }
      }}>
      <h2 id="close-batch-title">Close preparation batch?</h2>
      <p id="close-batch-description">Closing releases order ownership so orders can enter a future batch. Historical preparation is retained. This does not submit a PA.</p>
      <button ref={cancel} className={BUTTON} disabled={busy} onClick={onCancel}>Cancel closure</button>{' '}
      <button ref={confirm} className={BUTTON} disabled={busy} onClick={onConfirm}>Confirm close batch</button>
    </section>
  </div>
}
