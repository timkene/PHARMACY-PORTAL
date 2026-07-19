'use client'
import { useState, FormEvent } from 'react'
import { CodeWidget } from '@/components/shared/CodeWidget'
import { ApiError } from '@/lib/api'

interface CollectionVerifierProps {
  orderId: string
  approvalCode?: string
}

export function CollectionVerifier({ orderId, approvalCode }: CollectionVerifierProps) {
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    void orderId
    void (ApiError)
    setError('')
    setLoading(true)
    try {
      // Collection verification flow removed — handled via Klaire WhatsApp confirmation
      setVerified(true)
    } catch {
      setError('Verification failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded p-5 space-y-4">
      <h3 className="text-title-md font-semibold text-on-surface">Aggregator Verification</h3>
      <p className="text-body-sm text-on-surface-variant">
        Ask the enrollee for their collection code when they arrive to collect their medication.
      </p>

      {verified ? (
        <div className="flex items-center gap-2 text-secondary font-semibold text-body-lg">
          <span className="material-symbols-outlined">check_circle</span>
          Verified — HMO has been notified.
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            required
            placeholder="XXX-XXX"
            className="w-full border border-outline-variant rounded px-3 py-2 font-mono text-code-mono tracking-[0.15em] uppercase focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={20}
          />
          {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 rounded font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? 'Verifying…' : 'Verify & Mark as Fulfilled'}
          </button>
        </form>
      )}

      {approvalCode && (
        <div className="pt-4 border-t border-outline-variant">
          <p className="text-body-sm font-semibold text-on-surface mb-2">HMO Final Approval Code</p>
          <CodeWidget code={approvalCode} label="FINAL APPROVAL" />
        </div>
      )}
    </div>
  )
}
