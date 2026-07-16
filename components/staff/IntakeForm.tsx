'use client'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Enrollee, Medication } from '@/lib/types'

interface IntakeFormProps {
  onSubmit: (data: { enrollee: Enrollee; medications: Medication[] }) => void
  submitting: boolean
}

const EMPTY_MED: Medication = { name: '', dosage: '', quantity: 1, diagnosis: '' }

const INPUT_CLS =
  'w-full border border-outline-variant rounded px-3 py-2 text-body-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

export function IntakeForm({ onSubmit, submitting }: IntakeFormProps) {
  const [enrollee, setEnrollee] = useState<Enrollee>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
  })
  const [medications, setMedications] = useState<Medication[]>([])
  const [medError, setMedError] = useState('')

  const updateEnrollee = (field: keyof Enrollee, value: string) =>
    setEnrollee(prev => ({ ...prev, [field]: value }))

  const addMed = () => setMedications(prev => [...prev, { ...EMPTY_MED }])

  const updateMed = (idx: number, field: keyof Medication, value: string | number) =>
    setMedications(prev =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    )

  const removeMed = (idx: number) =>
    setMedications(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const filledMeds = medications.filter(m => m.name.trim())
    if (filledMeds.length === 0) {
      setMedError('Add at least one medication before submitting.')
      return
    }
    const missingDiagnosis = filledMeds.findIndex(m => !m.diagnosis.trim())
    if (missingDiagnosis !== -1) {
      setMedError(`Medication ${missingDiagnosis + 1} is missing a diagnosis.`)
      return
    }
    setMedError('')
    onSubmit({ enrollee, medications: filledMeds })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Left — Enrollee */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6 space-y-4">
          <h2 className="text-title-md font-semibold text-on-surface">Enrollee Details</h2>

          <div>
            <label className="block text-body-sm font-semibold mb-1">Full Name</label>
            <input
              required
              className={INPUT_CLS}
              placeholder="Jane Doe"
              value={enrollee.fullName}
              onChange={e => updateEnrollee('fullName', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-body-sm font-semibold mb-1">Email Address</label>
            <input
              required
              type="email"
              className={INPUT_CLS}
              placeholder="jane@example.com"
              value={enrollee.email}
              onChange={e => updateEnrollee('email', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-body-sm font-semibold mb-1">Phone Number</label>
            <input
              required
              type="tel"
              className={INPUT_CLS}
              placeholder="+234 800 000 0000"
              value={enrollee.phone}
              onChange={e => updateEnrollee('phone', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-body-sm font-semibold mb-1">Residential Address</label>
            <textarea
              required
              rows={3}
              className={INPUT_CLS}
              placeholder="123 Main St, Lagos"
              value={enrollee.address}
              onChange={e => updateEnrollee('address', e.target.value)}
            />
          </div>
        </div>

        {/* Right — Medications with per-item diagnosis */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title-md font-semibold text-on-surface">Medications</h2>
            <button
              type="button"
              onClick={addMed}
              className="text-primary text-body-sm font-semibold hover:underline"
            >
              Add Medication
            </button>
          </div>

          {medications.length === 0 && (
            <p className="text-body-sm text-on-surface-variant italic">
              No medications added yet. Each medication requires its own diagnosis.
            </p>
          )}

          <div className="space-y-3">
            {medications.map((med, idx) => (
              <div
                key={idx}
                className="border border-outline-variant rounded p-3 space-y-2 bg-surface-container/30"
              >
                {/* Diagnosis row */}
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <label className="block text-label-sm text-on-surface-variant mb-1">
                      Diagnosis / ICD-10
                    </label>
                    <input
                      className={INPUT_CLS}
                      placeholder="e.g. Diabetes mellitus (E11)"
                      value={med.diagnosis}
                      onChange={e => updateMed(idx, 'diagnosis', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMed(idx)}
                    aria-label="Remove medication"
                    className="mt-6 text-error hover:text-error/70 text-xl leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>

                {/* Name / Dosage / Qty row */}
                <div className="grid grid-cols-[1fr_100px_72px] gap-2">
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">
                      Medication Name
                    </label>
                    <input
                      className={INPUT_CLS}
                      placeholder="Paracetamol"
                      value={med.name}
                      onChange={e => updateMed(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">
                      Dosage
                    </label>
                    <input
                      className={INPUT_CLS}
                      placeholder="500mg"
                      value={med.dosage}
                      onChange={e => updateMed(idx, 'dosage', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min={1}
                      className={INPUT_CLS}
                      placeholder="1"
                      value={med.quantity}
                      onChange={e => updateMed(idx, 'quantity', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {medError && (
            <p role="alert" className="text-body-sm text-error mt-1">
              {medError}
            </p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="px-5 py-2.5 rounded border border-outline-variant text-on-surface font-semibold hover:bg-surface-low transition-colors"
        >
          Save Draft
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-5 py-2.5 rounded font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          {submitting ? 'Submitting…' : 'Submit for Bidding'}
        </button>
      </div>
    </form>
  )
}
