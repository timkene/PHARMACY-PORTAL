import type { Medication } from '@/lib/types'

interface MedicationTagProps {
  med: Medication
}

export function MedicationTag({ med }: MedicationTagProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-body-sm text-on-surface-variant border border-outline-variant">
      {med.diagnosisCode && (
        <>
          <span className="text-primary font-semibold font-mono">{med.diagnosisCode}</span>
          <span className="text-outline-variant">·</span>
        </>
      )}
      {med.procedureCode && (
        <>
          <span className="text-secondary font-semibold font-mono">{med.procedureCode}</span>
          <span className="text-outline-variant">·</span>
        </>
      )}
      {med.name} · {med.dosage}
      {med.tablets != null && <> · {med.tablets} tab{med.tablets !== 1 ? 's' : ''}</>}
      {med.frequency && <> · {med.frequency}</>}
      {med.durationDays != null && med.durationDays > 0 && <> · {med.durationDays}d</>}
    </span>
  )
}
