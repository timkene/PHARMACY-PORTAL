'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AggregatorShell } from '@/components/aggregator/AggregatorShell'
import { BidForm } from '@/components/aggregator/BidForm'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { MedicationTag } from '@/components/shared/MedicationTag'
import { Toast } from '@/components/shared/Toast'
import { useOrderStream } from '@/lib/sse'
import { getOrder, acceptOrder, fulfillOrder, ApiError } from '@/lib/api'
import type { Order, Bid, OrderStatus } from '@/lib/types'

export default function AggregatorOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [actioning, setActioning] = useState(false)
  const [fulfillMode, setFulfillMode] = useState<'delivered' | 'picked_up' | null>(null)
  const [deliveryFee, setDeliveryFee] = useState('')

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

  // Winner is determined by whether enrolleeId is populated (backend hides it from non-winners)
  const isWinner = !!order.enrollee.enrolleeId
  const bidClosed = status !== 'bidding'

  const handleAccept = async () => {
    setActioning(true)
    try {
      await acceptOrder(id)
      setStatus('accepted')
      setToast('Order accepted! The enrollee has been notified.')
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to accept order')
    } finally {
      setActioning(false)
    }
  }

  const handleFulfill = async (type: 'delivered' | 'picked_up') => {
    const fee = type === 'delivered' ? parseFloat(deliveryFee) : undefined
    if (type === 'delivered' && (!fee || fee <= 0)) {
      setToast('Please enter a valid delivery fee.')
      return
    }
    setActioning(true)
    try {
      await fulfillOrder(id, type, fee)
      if (type === 'picked_up') {
        setStatus('completed')
        setToast('Order closed — marked as picked up. Submitted for payment.')
      } else {
        setStatus('awaiting_confirmation')
        setToast('Order marked as delivered. Klaire will ask the enrollee to confirm receipt.')
      }
      setFulfillMode(null)
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to mark as fulfilled')
    } finally {
      setActioning(false)
    }
  }

  return (
    <AggregatorShell companyName="Your Pharmacy">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-6">
        {/* Prescription summary */}
        <div className="bg-surface-lowest border border-outline-variant rounded p-6">
          <p className="font-mono text-code-mono text-on-surface-variant mb-1">{order.intakeId}</p>
          <h1 className="text-title-md font-semibold text-on-surface mb-1">{order.enrollee.fullName}</h1>
          <p className="text-body-sm text-on-surface-variant mb-1">
            {order.medications.map(m => m.diagnosis).filter(Boolean).join(' · ')}
          </p>
          {order.enrollee.address && (
            <p className="text-body-sm text-on-surface-variant mb-3">
              Delivery address: <span className="font-semibold text-on-surface">{order.enrollee.address}</span>
            </p>
          )}
          {/* Phone is only visible to the winner */}
          {isWinner && order.enrollee.phone && (
            <p className="text-body-sm text-on-surface-variant mb-3">
              Enrollee phone: <span className="font-semibold text-on-surface">{order.enrollee.phone}</span>
              <span className="ml-1 font-mono text-code-mono text-on-surface-variant">({order.enrollee.enrolleeId})</span>
            </p>
          )}
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

        {/* You won — awaiting acceptance */}
        {status === 'awaiting_fulfillment' && isWinner && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5 space-y-3">
            <div>
              <p className="text-secondary font-bold text-title-md mb-1">You Were Selected!</p>
              <p className="text-body-sm text-on-surface-variant">
                Total: <span className="font-mono text-code-mono text-on-surface">₦{order.winnerTotalPrice?.toLocaleString()}</span>
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Please accept the order to confirm you can fulfil it, then deliver to the enrollee.
              </p>
            </div>
            <button
              onClick={handleAccept}
              disabled={actioning}
              className="px-5 py-2.5 rounded bg-secondary text-on-secondary font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-60"
            >
              {actioning ? 'Accepting…' : 'Accept Order'}
            </button>
          </div>
        )}

        {/* Another aggregator won */}
        {bidClosed && !isWinner && (
          <div className="bg-surface-container rounded p-5">
            <p className="text-body-sm font-semibold text-on-surface-variant">Session Closed</p>
            <p className="text-body-sm text-on-surface-variant mt-1">This order was awarded to another pharmacy.</p>
          </div>
        )}

        {/* Accepted — choose fulfillment type */}
        {status === 'accepted' && isWinner && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5 space-y-4">
            <div>
              <p className="text-secondary font-bold text-title-md mb-1">Order Accepted</p>
              <p className="text-body-sm text-on-surface-variant">
                How was this order fulfilled?
              </p>
            </div>

            {!fulfillMode && (
              <div className="flex gap-3">
                <button
                  onClick={() => setFulfillMode('picked_up')}
                  className="flex-1 px-4 py-3 rounded border-2 border-secondary text-secondary font-semibold text-body-sm hover:bg-secondary/10 transition-colors"
                >
                  <span className="block text-base">🏪</span>
                  Picked Up
                  <span className="block text-label-sm font-normal text-on-surface-variant mt-0.5">Enrollee collected in person</span>
                </button>
                <button
                  onClick={() => setFulfillMode('delivered')}
                  className="flex-1 px-4 py-3 rounded border-2 border-primary text-primary font-semibold text-body-sm hover:bg-primary/10 transition-colors"
                >
                  <span className="block text-base">🚚</span>
                  Delivered
                  <span className="block text-label-sm font-normal text-on-surface-variant mt-0.5">Medication was delivered</span>
                </button>
              </div>
            )}

            {fulfillMode === 'picked_up' && (
              <div className="space-y-3">
                <p className="text-body-sm text-on-surface-variant">Confirm the enrollee picked up their medication in person.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleFulfill('picked_up')}
                    disabled={actioning}
                    className="px-5 py-2.5 rounded bg-secondary text-on-secondary font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-60"
                  >
                    {actioning ? 'Submitting…' : 'Confirm Picked Up'}
                  </button>
                  <button onClick={() => setFulfillMode(null)} className="px-4 py-2.5 rounded border border-outline text-on-surface-variant text-body-sm hover:bg-surface-container transition-colors">
                    Back
                  </button>
                </div>
              </div>
            )}

            {fulfillMode === 'delivered' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-body-sm font-semibold text-on-surface mb-1">Delivery Fee (₦)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={deliveryFee}
                    onChange={e => setDeliveryFee(e.target.value)}
                    className="w-48 border border-outline rounded px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-label-sm text-on-surface-variant mt-1">This will be added to the total payment.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleFulfill('delivered')}
                    disabled={actioning}
                    className="px-5 py-2.5 rounded bg-primary text-on-primary font-semibold hover:bg-primary/80 transition-colors disabled:opacity-60"
                  >
                    {actioning ? 'Submitting…' : 'Confirm Delivered'}
                  </button>
                  <button onClick={() => setFulfillMode(null)} className="px-4 py-2.5 rounded border border-outline text-on-surface-variant text-body-sm hover:bg-surface-container transition-colors">
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Awaiting confirmation */}
        {status === 'awaiting_confirmation' && isWinner && (
          <div className="bg-surface-container rounded p-5">
            <p className="text-body-sm font-semibold text-on-surface">Awaiting Enrollee Confirmation</p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Klaire is confirming receipt with the enrollee via WhatsApp. You'll be notified of the outcome.
            </p>
          </div>
        )}

        {/* Completed */}
        {status === 'completed' && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5">
            <p className="text-secondary font-bold text-title-md mb-1">Order Completed</p>
            <p className="text-body-sm text-on-surface-variant">The enrollee confirmed they received their medication.</p>
          </div>
        )}

        {/* Not received */}
        {status === 'not_received' && (
          <div className="bg-error/10 border border-error/30 rounded p-5">
            <p className="text-error font-bold text-title-md mb-1">Enrollee Did Not Receive Medication</p>
            <p className="text-body-sm text-on-surface-variant">
              The enrollee reported non-receipt. Please contact the Clearline team at <strong>08076490056</strong> (WhatsApp, select Pharmacy) to resolve this.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Own bid status */}
          <div>
            {bids.length > 0 && (
              <div className="bg-surface-lowest border border-outline-variant rounded p-5">
                <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-1">Your Bid</p>
                <p className="font-mono text-code-mono text-on-surface text-title-md">
                  ₦{bids[0].totalPrice.toLocaleString()}
                </p>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  Submitted {new Date(bids[0].submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {status === 'bidding' && <BidForm orderId={id} medications={order.medications} />}
          </div>
        </div>
      </div>
    </AggregatorShell>
  )
}
