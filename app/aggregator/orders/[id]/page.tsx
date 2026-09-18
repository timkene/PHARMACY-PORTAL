'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { AggregatorShell } from '@/components/aggregator/AggregatorShell'
import { BidForm } from '@/components/aggregator/BidForm'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { MedicationTag } from '@/components/shared/MedicationTag'
import { Toast } from '@/components/shared/Toast'
import { useOrderStream } from '@/lib/sse'
import { getOrder, acceptOrder, fulfillOrder, submitDirectQuote, ApiError } from '@/lib/api'
import { AssignmentStatus } from '@/components/aggregator/AssignmentStatus'
import type { FormEvent } from 'react'
import { isDirectApproved, type Order, type Bid } from '@/lib/types'

export default function AggregatorOrderPage() {
  const { id } = useParams<{ id: string }>()
  return <AggregatorOrderDetail key={id} id={id} />
}

function AggregatorOrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const status = order?.status ?? null
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [actioning, setActioning] = useState(false)
  const [fulfillMode, setFulfillMode] = useState<'delivered' | 'picked_up' | null>(null)
  const [deliveryFee, setDeliveryFee] = useState('')

  const [totalPrice, setTotalPrice] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [fresh, setFresh] = useState(false)
  const pending = useRef(false)
  const revoked = useRef(false)
  const request = useRef(0)

  const clearAssignment = useCallback(() => {
    revoked.current = true
    request.current++
    setOrder(null)
    setBids([])
    setTotalPrice('')
    setDeliveryFee('')
    setFulfillMode(null)
    setFresh(false)
    setUnavailable(true)
    setLoading(false)
    setToast(null)
  }, [])

  const load = useCallback(async () => {
    if (revoked.current) return
    const sequence = ++request.current
    setFresh(false)
    try {
      const data = await getOrder(id)
      if (sequence !== request.current || revoked.current) return
      if (data.order.assignmentType === 'direct' &&
          data.order.status === 'direct_reassignment') {
        clearAssignment()
        return
      }
      setOrder(data.order)
      setBids(data.bids)
      setFresh(true)
    } catch (err) {
      if (sequence !== request.current) return
      if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
        clearAssignment()
      } else {
        setFresh(false)
        setToast(err instanceof ApiError ? err.message : 'Failed to refresh order. Please try again.')
      }
    } finally {
      if (sequence === request.current) setLoading(false)
    }
  }, [id, clearAssignment])

  useEffect(() => {
    const invalidate = () => { request.current++ }
    revoked.current = false
    setUnavailable(false)
    setOrder(null)
    setBids([])
    setLoading(true)
    void load()
    const refresh = () => { void load() }
    const timer = setInterval(refresh, 15_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      revoked.current = true
      invalidate()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [load])

  useOrderStream(unavailable ? null : id, {
    onBidUpdate: () => { void load() },
    onSessionClosed: () => { void load() },
    onOrderAccepted: () => { void load() },
    onOrderFulfilled: () => { void load() },
    onOrderCompleted: () => { void load() },
    onOrderNotReceived: () => { void load() },
    onOrderChanged: () => { void load() },
    onConnected: () => { void load() },
    onAccessRevoked: clearAssignment,
    onReconnecting: value => {
      setReconnecting(value)
      if (value) void load()
    },
  })

  if (unavailable) {
    return <AggregatorShell companyName="Your Pharmacy">
      <p role="status" className="p-8">Assignment no longer available.</p>
    </AggregatorShell>
  }

  if (loading || !order) {
    return (
      <AggregatorShell companyName="Your Pharmacy">
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        {!loading ? <div className="p-8"><button onClick={() => void load()}>Retry loading order</button></div> :
        <div className="p-8 space-y-4 animate-pulse">
          <div className="h-8 bg-surface-container rounded w-1/3" />
          <div className="h-40 bg-surface-container rounded" />
        </div>}
      </AggregatorShell>
    )
  }

  // Direct detail is authorized by the backend; competitive visibility is unchanged.
  const direct = order.assignmentType === 'direct'
  const isWinner = direct || !!order.enrollee.enrolleeId
  const bidClosed = status !== 'bidding'
  const inactive = ['direct_reassignment', 'cancelled', 'post_fulfilment_recalled'].includes(order.status)
  const approved = !direct || isDirectApproved(order)
  const disabled = actioning || !fresh || inactive
  const concurrency = direct ? { expectedVersion: order.version ?? 0 } : undefined

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    if (pending.current || disabled || revoked.current) return
    pending.current = true
    request.current++ // Ignore GETs started before this mutation.
    setActioning(true)
    setFresh(false)
    try {
      await action()
      if (!revoked.current) {
        setToast(success)
        setFulfillMode(null)
        setTotalPrice('')
        await load()
      }
    } catch (err) {
      if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
        clearAssignment()
      } else {
        setToast(err instanceof ApiError && err.status === 409
          ? 'This order changed. Review the refreshed order before trying again.'
          : err instanceof ApiError ? err.message : 'Unable to confirm the action. Review the refreshed order.')
        await load()
      }
    } finally {
      pending.current = false
      setActioning(false)
    }
  }

  const handleQuote = (event: FormEvent) => {
    event.preventDefault()
    const price = Number(totalPrice)
    if (!totalPrice.trim() || !Number.isFinite(price) || price <= 0) {
      setToast('Enter a total price greater than zero.')
      return
    }
    if (!direct || status !== 'direct_quote_requested') return
    void mutate(() => submitDirectQuote(id, { totalPrice: price, expectedVersion: order.version ?? 0 }),
      'Price submitted — awaiting Clearline approval')
  }

  const handleAccept = () => {
    if (status !== 'awaiting_fulfillment' || !approved) return
    void mutate(() => direct ? acceptOrder(id, concurrency) : acceptOrder(id),
      'Order accepted! The enrollee has been notified.')
  }

  const handleFulfill = (type: 'delivered' | 'picked_up') => {
    if (status !== 'accepted') return
    const fee = type === 'delivered' ? Number(deliveryFee) : undefined
    if (type === 'delivered' && (!deliveryFee.trim() || !Number.isFinite(fee) || (fee ?? -1) < 0)) {
      setToast('Please enter a valid delivery fee (zero or more).')
      return
    }
    void mutate(() => direct ? fulfillOrder(id, type, fee, concurrency) : fulfillOrder(id, type, fee),
      type === 'picked_up' ? 'Order closed — marked as picked up. Submitted for payment.'
        : 'Order marked as delivered. Klaire will ask the enrollee to confirm receipt.')
  }

  return (
    <AggregatorShell companyName="Your Pharmacy">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-6">
        {reconnecting && <p role="status">Reconnecting to order updates…</p>}
        {!fresh && !actioning && <button onClick={() => void load()}>Refresh order to enable actions</button>}
        {direct && <div className="space-y-2"><h2 className="text-title-md font-semibold">Direct Assignment</h2><AssignmentStatus order={order} /></div>}
        {inactive && <p role="status">This assignment is no longer active.</p>}
        {direct && status === 'direct_quote_requested' && (
          <form onSubmit={handleQuote} className="bg-surface-lowest border border-outline-variant rounded p-5 space-y-4">
            <label htmlFor="direct-total" className="block font-semibold">Total Price / Cost (₦)</label>
            <p className="text-body-sm text-on-surface-variant">Enter the total price for this prescription. Clearline will review it before you can accept.</p>
            <input id="direct-total" type="number" required min="0.01" step="0.01"
              value={totalPrice} disabled={disabled} onChange={e => setTotalPrice(e.target.value)}
              className="border border-outline rounded px-3 py-2" />
            <button type="submit" disabled={disabled} className="block bg-secondary text-on-secondary rounded px-5 py-2.5 font-semibold disabled:opacity-60">
              {actioning ? 'Submitting…' : 'Submit Price'}
            </button>
          </form>
        )}
        {direct && status === 'direct_price_review' && (
          <div className="bg-surface-container rounded p-5 space-y-2" role="status">
            <p className="font-semibold">Price submitted — awaiting Clearline approval</p>
            <p>Submitted price: ₦{order.directQuote?.totalPrice.toLocaleString() ?? '—'}</p>
            <p>No further action is required until Clearline responds.</p>
          </div>
        )}
        {direct && status === 'awaiting_fulfillment' && !approved && (
          <p role="status">This assignment needs Clearline price approval before acceptance. Please contact Clearline.</p>
        )}
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
        {!direct && status === 'bidding' && (
          <div className="bg-primary rounded p-5 flex items-center justify-between">
            <p className="text-on-primary text-body-lg font-semibold">Bidding Window Active</p>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-primary/60 text-[32px]">hourglass_top</span>
              <CountdownTimer endsAt={order.biddingEndsAt} />
            </div>
          </div>
        )}

        {/* You won — awaiting acceptance */}
        {status === 'awaiting_fulfillment' && isWinner && approved && (
          <div className="bg-secondary/10 border border-secondary/30 rounded p-5 space-y-3">
            <div>
              <p className="text-secondary font-bold text-title-md mb-1">{direct ? 'Price Approved — Accept Order' : 'You Were Selected!'}</p>
              <p className="text-body-sm text-on-surface-variant">
                Total: <span className="font-mono text-code-mono text-on-surface">₦{order.winnerTotalPrice?.toLocaleString()}</span>
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Please accept the order to confirm you can fulfil it, then deliver to the enrollee.
              </p>
            </div>
            <button
              onClick={handleAccept}
              disabled={disabled}
              className="px-5 py-2.5 rounded bg-secondary text-on-secondary font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-60"
            >
              {actioning ? 'Accepting…' : 'Accept Order'}
            </button>
          </div>
        )}

        {/* Another aggregator won */}
        {!direct && bidClosed && !isWinner && (
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
                  disabled={disabled}
                  onClick={() => setFulfillMode('picked_up')}
                  className="flex-1 px-4 py-3 rounded border-2 border-secondary text-secondary font-semibold text-body-sm hover:bg-secondary/10 transition-colors"
                >
                  <span className="block text-base">🏪</span>
                  Picked Up
                  <span className="block text-label-sm font-normal text-on-surface-variant mt-0.5">Enrollee collected in person</span>
                </button>
                <button
                  disabled={disabled}
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
                    disabled={disabled}
                    className="px-5 py-2.5 rounded bg-secondary text-on-secondary font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-60"
                  >
                    {actioning ? 'Submitting…' : 'Confirm Picked Up'}
                  </button>
                  <button disabled={disabled} onClick={() => setFulfillMode(null)} className="px-4 py-2.5 rounded border border-outline text-on-surface-variant text-body-sm hover:bg-surface-container transition-colors">
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
                    disabled={disabled}
                    className="px-5 py-2.5 rounded bg-primary text-on-primary font-semibold hover:bg-primary/80 transition-colors disabled:opacity-60"
                  >
                    {actioning ? 'Submitting…' : 'Confirm Delivered'}
                  </button>
                  <button disabled={disabled} onClick={() => setFulfillMode(null)} className="px-4 py-2.5 rounded border border-outline text-on-surface-variant text-body-sm hover:bg-surface-container transition-colors">
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
              Klaire is confirming receipt with the enrollee via WhatsApp. You&apos;ll be notified of the outcome.
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
            {!direct && bids.length > 0 && (
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
            {!direct && status === 'bidding' && <BidForm orderId={id} medications={order.medications} />}
          </div>
        </div>
      </div>
    </AggregatorShell>
  )
}
