'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AggregatorShell } from '@/components/aggregator/AggregatorShell'
import { BiddingTable } from '@/components/staff/BiddingTable'
import { BidForm } from '@/components/aggregator/BidForm'
import { CollectionVerifier } from '@/components/aggregator/CollectionVerifier'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { MedicationTag } from '@/components/shared/MedicationTag'
import { Toast } from '@/components/shared/Toast'
import { useOrderStream } from '@/lib/sse'
import { getOrder, ApiError } from '@/lib/api'
import type { Order, Bid, OrderStatus } from '@/lib/types'

export default function AggregatorOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [approvalCode, setApprovalCode] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getOrder(id)
      setOrder(data.order)
      setBids(data.bids)
      setStatus(data.status)
      setApprovalCode(data.order.approvalCode)
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useOrderStream(status === 'fulfilled' ? null : id, {
    onBidUpdate: ({ bids: newBids }) => setBids(newBids),
    onSessionClosed: ({ winnerId, winnerName, totalPrice }) => {
      setStatus('awaiting_fulfillment')
      setOrder(prev => prev ? { ...prev, winnerId, winnerName, winnerTotalPrice: totalPrice } : prev)
    },
    onCollectionVerified: () => setStatus('collection_verified'),
    onApprovalGenerated: ({ approvalCode: code }) => {
      setApprovalCode(code)
      setStatus('fulfilled')
    },
    onReconnecting: setReconnecting,
  })

  if (loading || !order) {
    return (
      <AggregatorShell companyName="Your Pharmacy">
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        <div className="p-8 space-y-4 animate-pulse">
          <div className="h-8 bg-surface-container rounded w-1/3" />
          <div className="h-40 bg-surface-container rounded" />
        </div>
      </AggregatorShell>
    )
  }

  const isWinner = order.winnerId !== undefined
  const bidClosed = status !== 'bidding'

  return (
    <AggregatorShell companyName="Your Pharmacy">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-6">
        {/* Prescription summary */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6">
          <p className="font-mono text-code-mono text-on-surface-variant mb-1">{order.intakeId}</p>
          <h1 className="text-title-md font-semibold text-on-surface mb-1">{order.enrollee.fullName}</h1>
          <p className="text-body-sm text-on-surface-variant mb-3">
            {order.medications.map(m => m.diagnosis).filter(Boolean).join(' · ')}
          </p>
          <div className="flex flex-wrap gap-2">
            {order.medications.map((med, i) => <MedicationTag key={i} med={med} />)}
          </div>
        </div>

        {/* Countdown banner */}
        {status === 'bidding' && (
          <div className="bg-primary rounded p-5 flex items-center justify-between">
            <p className="text-on-primary text-body-lg font-semibold">Bidding Window Active</p>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-primary/60 text-[32px]">hourglass_top</span>
              <CountdownTimer endsAt={order.biddingEndsAt} />
            </div>
          </div>
        )}

        {/* Outcome banners */}
        {bidClosed && isWinner && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5">
            <p className="text-secondary font-bold text-title-md mb-1">You Were Selected</p>
            <p className="text-body-sm text-on-surface-variant">
              Total: <span className="font-mono text-code-mono text-on-surface">₦{order.winnerTotalPrice?.toLocaleString()}</span>
            </p>
            <p className="text-body-sm text-on-surface-variant mt-1">Please await the enrollee for collection.</p>
          </div>
        )}

        {bidClosed && !isWinner && (
          <div className="bg-surface-container rounded p-5">
            <p className="text-body-sm font-semibold text-on-surface-variant">Session Closed</p>
            {order.winnerTotalPrice && (
              <p className="text-body-sm text-on-surface-variant mt-1">
                Winning price: <span className="font-mono text-code-mono">₦{order.winnerTotalPrice.toLocaleString()}</span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <BiddingTable bids={bids} reconnecting={reconnecting} />

          <div className="space-y-4">
            {status === 'bidding' && <BidForm orderId={id} />}
            {(status === 'awaiting_fulfillment' || status === 'collection_verified' || status === 'fulfilled') && isWinner && (
              <CollectionVerifier orderId={id} approvalCode={approvalCode} />
            )}
          </div>
        </div>
      </div>
    </AggregatorShell>
  )
}
