import type { Medication } from '@/lib/types'

interface MedicationTagProps {
  med: Medication
}

export function MedicationTag({ med }: MedicationTagProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-body-sm text-on-surface-variant border border-outline-variant">
      {med.name} · {med.dosage} × {med.quantity}
    </span>
  )
}
