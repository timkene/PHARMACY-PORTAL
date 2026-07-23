'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AggregatorShell } from '@/components/aggregator/AggregatorShell'
import { CountdownTimer } from '@/components/shared/CountdownTimer'
import { Toast } from '@/components/shared/Toast'
import { getAggregatorOrders, ApiError } from '@/lib/api'
import type { AggregatorOrdersResponse, Order } from '@/lib/types'

type Tab = 'open' | 'active' | 'fulfilled'

const STATUS_LABEL: Record<string, string> = {
  awaiting_fulfillment:  'Awaiting Acceptance',
  accepted:              'Accepted',
  awaiting_confirmation: 'Awaiting Confirmation',
  completed:             'Completed',
  bidding:               'Bidding',
}

function TabBtn({ id, active, label, count, onClick }: {
  id: Tab; active: boolean; label: string; count: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded font-semibold text-body-sm transition-colors relative ${
        active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-2 text-label-sm px-1.5 py-0.5 rounded-full ${
          active ? 'bg-on-primary/20 text-on-primary' : 'bg-primary/10 text-primary'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function OpenOrderRow({ order }: { order: Order }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-code-mono text-on-surface">{order.intakeId}</p>
        <p className="text-body-sm text-on-surface-variant truncate">
          {order.medications?.map((m: { diagnosis?: string }) => m.diagnosis).filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-4">
        <div className="text-right">
          <p className="text-label-caps text-on-surface-variant uppercase tracking-widest text-xs mb-0.5">Time Left</p>
          <CountdownTimer endsAt={order.biddingEndsAt} />
        </div>
        <Link
          href={`/aggregator/orders/${order.id}`}
          className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-1.5 rounded font-semibold text-body-sm transition-colors"
        >
          Bid
        </Link>
      </div>
    </div>
  )
}

function ActiveOrderRow({ order }: { order: Order }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-code-mono text-on-surface">{order.intakeId}</p>
        <p className="text-body-sm text-on-surface-variant">{order.enrollee?.fullName || '—'}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-4">
        <span className="text-body-sm text-secondary font-semibold">
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
        <Link
          href={`/aggregator/orders/${order.id}`}
          className="bg-secondary hover:bg-secondary/90 text-on-secondary px-4 py-1.5 rounded font-semibold text-body-sm transition-colors"
        >
          View
        </Link>
      </div>
    </div>
  )
}

function FulfilledTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-outline-variant">
            {['Order ID', 'Enrollee', 'Date', 'Your Earnings'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-label-caps text-on-surface-variant uppercase tracking-widest">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, idx) => (
            <tr key={o.id} className={idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}>
              <td className="px-4 py-3 font-mono text-code-mono text-on-surface">{o.intakeId}</td>
              <td className="px-4 py-3 text-body-sm text-on-surface-variant">{o.enrollee?.fullName || '—'}</td>
              <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 font-mono text-code-mono text-on-surface font-semibold">
                {o.winnerTotalPrice != null ? `₦${o.winnerTotalPrice.toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AggregatorOrdersPage() {
  const [data, setData] = useState<AggregatorOrdersResponse | null>(null)
  const [tab, setTab] = useState<Tab>('open')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await getAggregatorOrders())
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 5_000)
    return () => clearInterval(id)
  }, [load])

  const counts = data?.counts ?? { open: 0, active: 0, fulfilled: 0 }

  return (
    <AggregatorShell companyName="Your Pharmacy">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-title-lg font-semibold text-on-surface">Orders</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Refreshes every 5 seconds</p>
          </div>
        </div>

        <div className="flex gap-2">
          <TabBtn id="open"      active={tab === 'open'}      label="Open Bidding" count={counts.open}      onClick={() => setTab('open')} />
          <TabBtn id="active"    active={tab === 'active'}    label="Active"       count={counts.active}    onClick={() => setTab('active')} />
          <TabBtn id="fulfilled" active={tab === 'fulfilled'} label="Fulfilled"    count={counts.fulfilled} onClick={() => setTab('fulfilled')} />
        </div>

        <div className="bg-surface-lowest border border-outline-variant rounded overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-surface-container rounded animate-pulse" />)}
            </div>
          ) : (
            <>
              {tab === 'open' && (
                data?.open.length
                  ? data.open.map(o => <OpenOrderRow key={o.id} order={o} />)
                  : <p className="p-8 text-body-sm text-on-surface-variant text-center">No open bidding sessions right now.</p>
              )}
              {tab === 'active' && (
                data?.active.length
                  ? data.active.map(o => <ActiveOrderRow key={o.id} order={o} />)
                  : <p className="p-8 text-body-sm text-on-surface-variant text-center">No active orders.</p>
              )}
              {tab === 'fulfilled' && (
                data?.fulfilled.length
                  ? <FulfilledTable orders={data.fulfilled} />
                  : <p className="p-8 text-body-sm text-on-surface-variant text-center">No fulfilled orders yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </AggregatorShell>
  )
}
