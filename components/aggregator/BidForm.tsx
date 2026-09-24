'use client'
import { useState, FormEvent } from 'react'
import { placeBid, ApiError } from '@/lib/api'
import type { Medication } from '@/lib/types'
import { medicationSubtotal, procedurePrices } from '@/lib/procedure-pricing'

interface BidFormProps {
  orderId: string
  medications: Medication[]
  disabled?: boolean
}

export function BidForm({ orderId, medications, disabled = false }: BidFormProps) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submittedTotal, setSubmittedTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  if (disabled) {
    return (
      <div className="bg-surface-container rounded p-5 text-center text-body-sm text-on-surface-variant">
        Bidding has ended for this session.
      </div>
    )
  }

  const legacy = medications.some(med => !med.lineId)
  const missingCode = !legacy && medications.some(med => !med.procedureCode)
  const validLines = legacy ? null : procedurePrices(medications, prices)
  const grandTotal = legacy ? medications.reduce((sum, med, idx) => sum + Number(prices[String(idx)] || 0) * (med.quantity || 1), 0)
    : validLines ? medicationSubtotal(validLines) : 0

  if (submitted && !editing) {
    return (
      <div className="bg-secondary/5 border border-secondary/20 rounded p-5">
        <p className="text-secondary font-semibold text-body-lg mb-1">Bid Submitted</p>
        <p className="font-mono text-code-mono text-on-surface">₦{submittedTotal.toLocaleString()}</p>
        <button onClick={() => setEditing(true)} className="text-primary text-body-sm hover:underline mt-2">
          Update Bid
        </button>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (missingCode) { setError('This order is missing a procedure code. Ask Clearline to correct the order.'); return }
    if ((!legacy && !validLines) || (legacy && (!Number.isFinite(grandTotal) || grandTotal <= 0))) {
      setError('Enter a positive price for every medication procedure.')
      return
    }
    setLoading(true)
    try {
      if (legacy) await placeBid(orderId, grandTotal)
      else await placeBid(orderId, validLines!)
      setSubmitted(true)
      setEditing(false)
      setSubmittedTotal(grandTotal)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit bid')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded p-5">
      <h3 className="text-title-md font-semibold text-on-surface mb-4">Place Your Bid</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          {medications.map((med, idx) => (
            <div key={med.lineId ?? idx} className="bg-surface-container rounded p-3 space-y-2">
              <p className="text-body-sm font-semibold text-on-surface">{med.procedureCode} — {med.name}</p>
              <p className="text-label-sm text-on-surface-variant">
                {med.dosage} · {med.quantity} unit{med.quantity !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-label-sm text-on-surface-variant mb-1">
                    {legacy ? 'Unit Price (₦)' : `Total price for ${med.quantity} units (₦)`}
                  </label>
                  <input
                    type="number" required min="0.01" step="0.01"
                    value={prices[med.lineId ?? String(idx)] ?? ''}
                    onChange={e => setPrices(prev => ({ ...prev, [med.lineId ?? String(idx)]: e.target.value }))}
                    className="w-full border border-outline-variant rounded px-3 py-1.5 text-body-md font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="0.00"
                  />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-label-sm text-on-surface-variant mb-1">Line Total</p>
                  <p className="font-mono text-code-mono text-on-surface font-bold">₦{(Number(prices[med.lineId ?? String(idx)] || 0) * (legacy ? med.quantity || 1 : 1)).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-outline-variant pt-3">
          <span className="text-body-sm font-semibold text-on-surface">Total Quote</span>
          <span className="font-mono text-code-mono text-on-surface font-bold text-title-md">
            ₦{grandTotal.toLocaleString()}
          </span>
        </div>

        <p className="text-body-sm text-on-surface-variant">
          By submitting, you commit to fulfilling this prescription at the stated price if selected.
        </p>
        {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full bg-secondary hover:bg-secondary/90 text-on-secondary py-2.5 rounded font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? 'Submitting…' : 'Submit Bid'}
        </button>
      </form>
    </div>
  )
}
