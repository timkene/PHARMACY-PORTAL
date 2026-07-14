type ChipStatus = 'active' | 'pending' | 'error' | 'info'

const CHIP_CLASSES: Record<ChipStatus, string> = {
  active:  'bg-secondary/15 text-secondary',
  pending: 'bg-amber-100 text-amber-700',
  error:   'bg-error/15 text-error',
  info:    'bg-primary/15 text-primary',
}

interface StatusChipProps {
  status: ChipStatus
  label: string
}

export function StatusChip({ status, label }: StatusChipProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-label-caps font-bold uppercase tracking-widest ${CHIP_CLASSES[status]}`}>
      {label}
    </span>
  )
}
