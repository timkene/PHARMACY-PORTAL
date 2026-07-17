'use client'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Enrollee, Medication, MedicationFrequency, Provider } from '@/lib/types'
import { SearchComboBox } from '@/components/shared/SearchComboBox'
import {
  searchMembers,
  searchProviders,
  searchProcedures,
  searchDiagnoses,
} from '@/lib/api'

interface IntakeFormProps {
  onSubmit: (data: { enrollee: Enrollee; provider: Provider; medications: Medication[] }) => void
  submitting: boolean
}

const FREQUENCY_OPTIONS: MedicationFrequency[] = [
  'every 24 hrs',
  'every 12 hrs',
  'every 8 hrs',
  'every 6 hrs',
  'every week',
  'every month',
]

const EMPTY_MED: Medication = {
  procedureCode: '',
  name: '',
  dosage: '',
  quantity: 1,
  tablets: 1,
  frequency: '',
  durationDays: 1,
  diagnosisCode: '',
  diagnosis: '',
}

const INPUT_CLS =
  'w-full border border-outline-variant rounded px-3 py-2 text-body-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

export function IntakeForm({ onSubmit, submitting }: IntakeFormProps) {
  const [enrollee, setEnrollee] = useState<Enrollee>({ enrolleeId: '', fullName: '' })
  const [provider, setProvider] = useState<Provider>({ providerId: '', providerName: '' })
  const [medications, setMedications] = useState<Medication[]>([])
  const [medError, setMedError] = useState('')

  // ── Medication helpers ─────────────────────────────────────────────────────

  const addMed = () => setMedications(prev => [...prev, { ...EMPTY_MED }])

  const updateMed = (idx: number, patch: Partial<Medication>) =>
    setMedications(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const removeMed = (idx: number) =>
    setMedications(prev => prev.filter((_, i) => i !== idx))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!enrollee.enrolleeId) {
      setMedError('Please select an enrollee.')
      return
    }
    if (!provider.providerId) {
      setMedError('Please select a provider.')
      return
    }
    const filledMeds = medications.filter(m => m.name.trim())
    if (filledMeds.length === 0) {
      setMedError('Add at least one medication / procedure before submitting.')
      return
    }
    const missingDiag = filledMeds.findIndex(m => !m.diagnosis.trim())
    if (missingDiag !== -1) {
      setMedError(`Medication ${missingDiag + 1} is missing a diagnosis.`)
      return
    }
    const missingFreq = filledMeds.findIndex(m => !m.frequency)
    if (missingFreq !== -1) {
      setMedError(`Medication ${missingFreq + 1} is missing a frequency.`)
      return
    }
    const badDuration = filledMeds.findIndex(m => !m.durationDays || m.durationDays < 1)
    if (badDuration !== -1) {
      setMedError(`Medication ${badDuration + 1} needs a valid course duration.`)
      return
    }
    setMedError('')
    onSubmit({ enrollee, provider, medications: filledMeds })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Left — Enrollee + Provider */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6 space-y-5">
          <h2 className="text-title-md font-semibold text-on-surface">Enrollee & Provider</h2>

          {/* Enrollee */}
          <div>
            <label className="block text-body-sm font-semibold mb-1">
              Enrollee ID <span className="text-on-surface-variant font-normal">(search by ID or name)</span>
            </label>
            <SearchComboBox
              placeholder="e.g. CL12345 or Jane Doe"
              onSearch={searchMembers}
              onSelect={r => setEnrollee({ enrolleeId: r.code, fullName: r.label })}
              displayValue={enrollee.enrolleeId ? `${enrollee.enrolleeId} — ${enrollee.fullName}` : ''}
            />
            {enrollee.enrolleeId && (
              <p className="text-label-sm text-on-surface-variant mt-1">
                Selected: <span className="font-semibold text-on-surface">{enrollee.fullName}</span>
                {' '}
                <span className="font-mono">({enrollee.enrolleeId})</span>
              </p>
            )}
          </div>

          {/* Provider */}
          <div>
            <label className="block text-body-sm font-semibold mb-1">
              Provider Source <span className="text-on-surface-variant font-normal">(search by name or ID)</span>
            </label>
            <SearchComboBox
              placeholder="e.g. St. Mary's Hospital"
              onSearch={searchProviders}
              onSelect={r => setProvider({ providerId: r.code, providerName: r.label })}
              displayValue={provider.providerId ? `${provider.providerId} — ${provider.providerName}` : ''}
            />
            {provider.providerId && (
              <p className="text-label-sm text-on-surface-variant mt-1">
                Selected: <span className="font-semibold text-on-surface">{provider.providerName}</span>
                {' '}
                <span className="font-mono">({provider.providerId})</span>
              </p>
            )}
          </div>
        </div>

        {/* Right — Medications */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title-md font-semibold text-on-surface">Medications / Procedures</h2>
            <button
              type="button"
              onClick={addMed}
              className="text-primary text-body-sm font-semibold hover:underline"
            >
              Add Line
            </button>
          </div>

          {medications.length === 0 && (
            <p className="text-body-sm text-on-surface-variant italic">
              Each line item links one diagnosis to one procedure.
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
                      Diagnosis (ICD-10)
                    </label>
                    <SearchComboBox
                      placeholder="Search diagnosis…"
                      onSearch={searchDiagnoses}
                      onSelect={r => updateMed(idx, { diagnosisCode: r.code, diagnosis: r.label })}
                      displayValue={med.diagnosisCode ? `${med.diagnosisCode} — ${med.diagnosis}` : ''}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMed(idx)}
                    aria-label="Remove line"
                    className="mt-6 text-error hover:text-error/70 text-xl leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>

                {/* Procedure row */}
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1">
                    Procedure / Medication
                  </label>
                  <SearchComboBox
                    placeholder="Search procedure or medication…"
                    onSearch={searchProcedures}
                    onSelect={r => updateMed(idx, { procedureCode: r.code, name: r.label })}
                    displayValue={med.procedureCode ? `${med.procedureCode} — ${med.name}` : ''}
                  />
                </div>

                {/* Dosage / Qty row */}
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">Dosage</label>
                    <input
                      className={INPUT_CLS}
                      placeholder="e.g. 500mg"
                      value={med.dosage}
                      onChange={e => updateMed(idx, { dosage: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className={INPUT_CLS}
                      placeholder="1"
                      value={med.quantity}
                      onChange={e => updateMed(idx, { quantity: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Tablets / Frequency / Duration row */}
                <div className="grid grid-cols-[72px_1fr_96px] gap-2">
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">Tablets</label>
                    <input
                      type="number"
                      min={1}
                      className={INPUT_CLS}
                      placeholder="1"
                      value={med.tablets}
                      onChange={e => updateMed(idx, { tablets: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">Frequency</label>
                    <select
                      className={INPUT_CLS}
                      value={med.frequency}
                      onChange={e => updateMed(idx, { frequency: e.target.value as MedicationFrequency })}
                    >
                      <option value="">Select…</option>
                      {FREQUENCY_OPTIONS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-label-sm text-on-surface-variant mb-1">Duration (days)</label>
                    <input
                      type="number"
                      min={1}
                      className={INPUT_CLS}
                      placeholder="7"
                      value={med.durationDays || ''}
                      onChange={e => updateMed(idx, { durationDays: Number(e.target.value) })}
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

      {/* Footer */}
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
