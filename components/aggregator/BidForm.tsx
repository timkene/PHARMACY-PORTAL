'use client'
import { useState, FormEvent } from 'react'
import { placeBid, ApiError } from '@/lib/api'

interface BidFormProps {
  orderId: string
  disabled?: boolean
}

export function BidForm({ orderId, disabled = false }: BidFormProps) {
  const [unitPrice, setUnitPrice] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
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
    setLoading(true)
    try {
      await placeBid(orderId, Number(unitPrice), Number(totalPrice))
      setSubmitted(true)
      setEditing(false)
      setSubmittedTotal(Number(totalPrice))
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
        <div>
          <label htmlFor="unit-price" className="block text-body-sm font-semibold mb-1">Unit Price Per Medication (₦)</label>
          <input
            id="unit-price"
            type="number" min="0" step="0.01" required
            value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
            className="w-full border border-outline-variant rounded px-3 py-2 text-body-lg font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="total-price" className="block text-body-sm font-semibold mb-1">Total Aggregate Price (₦)</label>
          <input
            id="total-price"
            type="number" min="0" step="0.01" required
            value={totalPrice} onChange={e => setTotalPrice(e.target.value)}
            className="w-full border border-outline-variant rounded px-3 py-2 text-body-lg font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="0.00"
          />
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
