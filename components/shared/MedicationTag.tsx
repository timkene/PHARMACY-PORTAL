import type { Medication } from '@/lib/types'

interface MedicationTagProps {
  med: Medication
}

export function MedicationTag({ med }: MedicationTagProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-body-sm text-on-surface-variant border border-outline-variant">
      {med.diagnosis && (
        <>
          <span className="text-primary font-semibold">{med.diagnosis}</span>
          <span className="text-outline-variant">·</span>
        </>
      )}
      {med.name} · {med.dosage} × {med.quantity}
    </span>
  )
}
