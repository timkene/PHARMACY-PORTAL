'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { StaffShell } from '@/components/staff/StaffShell'
import { BiddingTable } from '@/components/staff/BiddingTable'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { MedicationTag } from '@/components/shared/MedicationTag'
import { StatusChip } from '@/components/shared/StatusChip'
import { Toast } from '@/components/shared/Toast'
import { useOrderStream } from '@/lib/sse'
import { getOrder, ApiError } from '@/lib/api'
import type { Order, Bid, OrderStatus } from '@/lib/types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  bidding: 'Bidding Active',
  awaiting_fulfillment: 'Awaiting Acceptance',
  accepted: 'Order Accepted',
  awaiting_confirmation: 'Awaiting Enrollee Confirmation',
  completed: 'Completed',
  not_received: 'Not Received — Follow Up Required',
}

function OrderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-surface-container rounded w-1/3" />
      <div className="h-32 bg-surface-container rounded" />
      <div className="h-64 bg-surface-container rounded" />
    </div>
  )
}

export default function StaffOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getOrder(id)
      setOrder(data.order)
      setBids(data.bids)
      setStatus(data.status)
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const isTerminal = status === 'completed' || status === 'not_received'

  useOrderStream(isTerminal ? null : id, {
    onBidUpdate: ({ bids: newBids }) => setBids(newBids),
    onSessionClosed: ({ winnerId, winnerName, totalPrice }) => {
      setStatus('awaiting_fulfillment')
      setOrder(prev => prev ? { ...prev, winnerId, winnerName, winnerTotalPrice: totalPrice } : prev)
    },
    onOrderAccepted: () => setStatus('accepted'),
    onOrderFulfilled: () => setStatus('awaiting_confirmation'),
    onOrderCompleted: () => setStatus('completed'),
    onOrderNotReceived: () => setStatus('not_received'),
    onReconnecting: setReconnecting,
  })

  if (loading) {
    return (
      <StaffShell userName="Staff">
        <div className="p-8"><OrderSkeleton /></div>
      </StaffShell>
    )
  }

  if (!order || !status) return null

  const avgBidPrice = bids.length > 0
    ? bids.reduce((sum, b) => sum + b.totalPrice, 0) / bids.length
    : 0
  const savings = order.winnerTotalPrice && avgBidPrice > 0
    ? avgBidPrice - order.winnerTotalPrice
    : 0

  return (
    <StaffShell userName="Staff">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-6">

        {/* Breadcrumb */}
        <nav className="text-body-sm text-on-surface-variant">
          Prescriptions ›{' '}
          <span className="font-mono text-on-surface">{order.intakeId}</span>
        </nav>

        {/* Prescription summary card */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-title-md shrink-0">
              {order.enrollee.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-title-md font-semibold text-on-surface">
                {order.enrollee.fullName}
              </h1>
              <p className="text-body-sm text-on-surface-variant">
                {order.enrollee.enrolleeId && (
                  <span className="font-mono mr-2">{order.enrollee.enrolleeId}</span>
                )}
                {order.medications.map(m => m.diagnosis).filter(Boolean).join(' · ')}
              </p>
              {order.enrollee.phone && (
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  Phone: <span className="font-semibold text-on-surface">{order.enrollee.phone}</span>
                </p>
              )}
              {order.enrollee.address && (
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  Address: <span className="font-semibold text-on-surface">{order.enrollee.address}</span>
                </p>
              )}
              {order.provider && (
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  Provider: <span className="font-semibold text-on-surface">{order.provider.providerName}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.medications.map((med, i) => (
              <MedicationTag key={i} med={med} />
            ))}
          </div>
        </div>

        {/* STATE 1: Bidding Active */}
        {status === 'bidding' && (
          <div className="bg-primary rounded p-5 flex items-center justify-between">
            <div>
              <p className="text-on-primary/60 text-label-caps uppercase tracking-widest mb-1">
                Bidding Window Active
              </p>
              <p className="text-on-primary text-body-sm">
                {bids.length} aggregator{bids.length !== 1 ? 's' : ''} responding
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-primary/60 text-[32px]">
                hourglass_top
              </span>
              <CountdownTimer endsAt={order.biddingEndsAt} />
            </div>
          </div>
        )}

        {/* STATE 2: Winner selected — awaiting acceptance */}
        {status === 'awaiting_fulfillment' && (
          <div className="bg-surface-lowest border border-outline-variant rounded p-6 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusChip status="pending" label="Awaiting Acceptance" />
              <span className="text-body-sm font-bold text-on-surface">
                Winner: {order.winnerName}
              </span>
              {order.winnerTotalPrice ? (
                <span className="font-mono text-code-mono text-on-surface">
                  ₦{order.winnerTotalPrice.toLocaleString()}
                </span>
              ) : null}
              {savings > 0 && (
                <span className="text-body-sm text-secondary">
                  ↓ ₦{savings.toLocaleString()} saved vs avg
                </span>
              )}
            </div>
            <p className="text-body-sm text-on-surface-variant">
              {order.winnerName
                ? `Waiting for ${order.winnerName} to accept the order. The enrollee has been notified via WhatsApp.`
                : 'Bidding closed with no bids received.'}
            </p>
          </div>
        )}

        {/* STATE 3: Accepted */}
        {status === 'accepted' && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5 space-y-1">
            <div className="flex items-center gap-3">
              <StatusChip status="active" label="Order Accepted" />
              <span className="text-body-sm font-bold text-on-surface">{order.winnerName}</span>
              <span className="font-mono text-code-mono text-on-surface">
                ₦{order.winnerTotalPrice?.toLocaleString()}
              </span>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              The pharmacy has accepted and is preparing the medication. The enrollee has been notified.
            </p>
          </div>
        )}

        {/* STATE 4: Awaiting confirmation from enrollee */}
        {status === 'awaiting_confirmation' && (
          <div className="bg-surface-container rounded p-5 space-y-1">
            <StatusChip status="pending" label="Awaiting Enrollee Confirmation" />
            <p className="text-body-sm text-on-surface-variant mt-2">
              Klaire has asked the enrollee to confirm receipt. Waiting for their reply.
            </p>
          </div>
        )}

        {/* STATE 5: Completed */}
        {status === 'completed' && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5">
            <p className="text-secondary font-bold text-title-md mb-1">Order Completed</p>
            <p className="text-body-sm text-on-surface-variant">
              The enrollee confirmed they received their medication.
            </p>
          </div>
        )}

        {/* STATE 6: Not received */}
        {status === 'not_received' && (
          <div className="bg-error/10 border border-error/30 rounded p-5">
            <p className="text-error font-bold text-title-md mb-1">Medication Not Received</p>
            <p className="text-body-sm text-on-surface-variant">
              The enrollee reported they did not receive their medication. Please follow up with {order.winnerName} immediately.
            </p>
          </div>
        )}

        {/* Bids table — always visible */}
        <BiddingTable bids={bids} reconnecting={reconnecting} />
      </div>
    </StaffShell>
  )
}
