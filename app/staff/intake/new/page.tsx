'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StaffShell } from '@/components/staff/StaffShell'
import { IntakeForm } from '@/components/staff/IntakeForm'
import { Toast } from '@/components/shared/Toast'
import { createOrder, ApiError } from '@/lib/api'
import type { Enrollee, Medication, Provider } from '@/lib/types'

function generateIntakeId(): string {
  const n = Math.floor(10_000 + Math.random() * 90_000)
  const s = Math.random().toString(36).slice(2, 4).toUpperCase()
  return `INTAKE-${n}-${s}`
}

export default function NewIntakePage() {
  const router = useRouter()
  const [intakeId] = useState(generateIntakeId)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleSubmit = async (data: {
    enrollee: Enrollee
    provider: Provider
    medications: Medication[]
  }) => {
    setSubmitting(true)
    try {
      const { orderId } = await createOrder(data)
      router.push(`/staff/orders/${orderId}`)
    } catch (err) {
      setToast(
        err instanceof ApiError ? err.message : 'Failed to create intake. Please try again.'
      )
      setSubmitting(false)
    }
  }

  return (
    <StaffShell userName="Staff">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-headline-lg font-semibold text-on-surface">New Prescription Intake</h1>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Fill out the details below to open a bidding session.
            </p>
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-0.5">
              Intake ID
            </p>
            <p className="font-mono text-code-mono text-on-surface">{intakeId}</p>
          </div>
        </div>
        <IntakeForm onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </StaffShell>
  )
}
