import Link from 'next/link'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { MedicationTag } from '@/components/shared/MedicationTag'
import type { Order } from '@/lib/types'

export function OrderCard({ order }: { order: Order }) {
  const shownMeds = order.medications.slice(0, 2)
  const extra = order.medications.length - shownMeds.length

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-code-mono text-on-surface-variant mb-1">{order.intakeId}</p>
          <p className="text-body-sm text-on-surface">{order.diagnosis}</p>
        </div>
        <div className="text-right">
          <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-0.5">Time Left</p>
          <CountdownTimer endsAt={order.biddingEndsAt} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {shownMeds.map((med, i) => <MedicationTag key={i} med={med} />)}
        {extra > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-body-sm text-on-surface-variant">
            +{extra} more
          </span>
        )}
      </div>

      <Link
        href={`/aggregator/orders/${order.id}`}
        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-container text-on-primary py-2 rounded font-semibold text-body-sm transition-colors"
      >
        View & Bid
      </Link>
    </div>
  )
}
