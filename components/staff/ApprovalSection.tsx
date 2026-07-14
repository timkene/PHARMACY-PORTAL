'use client'
import { useState } from 'react'
import { CodeWidget } from '@/components/shared/CodeWidget'
import { generateApproval, ApiError } from '@/lib/api'

interface ApprovalSectionProps {
  orderId: string
  enabled: boolean
  existingCode?: string
  onGenerated: (code: string) => void
}

export function ApprovalSection({ orderId, enabled, existingCode, onGenerated }: ApprovalSectionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const { approvalCode } = await generateApproval(orderId)
      onGenerated(approvalCode)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate approval code')
    } finally {
      setLoading(false)
    }
  }

  if (existingCode) {
    return (
      <div>
        <h2 className="text-title-md font-semibold text-on-surface mb-3">Final Approval Code</h2>
        <CodeWidget code={existingCode} label="FINAL APPROVAL" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-title-md font-semibold text-on-surface mb-3">Generate Approval Code</h2>
      {!enabled && (
        <p className="text-body-sm text-on-surface-variant mb-3">
          Unlock after aggregator verifies collection.
        </p>
      )}
      {error && (
        <p role="alert" className="text-body-sm text-error mb-3">{error}</p>
      )}
      <button
        onClick={handleGenerate}
        disabled={!enabled || loading}
        title={!enabled ? 'Unlock after aggregator verifies collection' : undefined}
        className="flex items-center gap-2 bg-secondary hover:bg-secondary/90 text-on-secondary px-5 py-2.5 rounded font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[18px]">
          {loading ? 'hourglass_top' : 'verified'}
        </span>
        {loading ? 'Generating…' : 'Generate Approval Code'}
      </button>
    </div>
  )
}
