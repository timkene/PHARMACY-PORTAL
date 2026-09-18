'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { AssignmentStatus } from '@/components/aggregator/AssignmentStatus'
import { AggregatorShell } from '@/components/aggregator/AggregatorShell'
import { OrderCard } from '@/components/aggregator/OrderCard'
import { Toast } from '@/components/shared/Toast'
import { getAggregatorDashboard, ApiError } from '@/lib/api'
import type { AggregatorDashboard } from '@/lib/types'

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-title-md font-semibold text-on-surface mb-4">{title}</h2>
}

export default function AggregatorDashboardPage() {
  const [data, setData] = useState<AggregatorDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const request = useRef(0)
  const load = useCallback(async () => {
    const sequence = ++request.current
    try {
      const d = await getAggregatorDashboard()
      if (sequence === request.current) setData(d)
    } catch (err) {
      if (sequence !== request.current) return
      setData(null)
      setToast(err instanceof ApiError ? err.message : 'Failed to load dashboard')
    } finally {
      if (sequence === request.current) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll every 15 s so new bidding sessions appear without a manual refresh
  useEffect(() => {
    const invalidate = () => { request.current++ }
    const id = setInterval(load, 15_000)
    window.addEventListener('focus', load)
    window.addEventListener('online', load)
    return () => {
      invalidate()
      clearInterval(id)
      window.removeEventListener('focus', load)
      window.removeEventListener('online', load)
    }
  }, [load])

  return (
    <AggregatorShell companyName="Your Pharmacy">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-10">
        {data && <section>
          <SectionHeader title="Direct Assignments" />
          <p className="text-body-sm text-on-surface-variant">
            {data.wonOrders.filter(o => o.assignmentType === 'direct' && o.status === 'direct_quote_requested').length} awaiting price submission
            {' · '}{data.wonOrders.filter(o => o.assignmentType === 'direct' && o.status === 'direct_price_review').length} awaiting Clearline approval
          </p>
        </section>}
        {/* Open Bidding */}
        <section>
          <SectionHeader title="Open Bidding Sessions" />
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map(i => <div key={i} className="h-40 bg-surface-container rounded animate-pulse" />)}
            </div>
          ) : data?.openSessions?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.openSessions.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">No active sessions right now. Check back soon.</p>
          )}
        </section>

        {/* Won Orders */}
        {data?.wonOrders?.length ? (
          <section>
            <SectionHeader title="Your Active Orders" />
            <div className="bg-surface-lowest border border-outline-variant rounded divide-y divide-outline-variant">
              {data.wonOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-mono text-code-mono text-on-surface">{order.intakeId}</p>
                    <p className="text-body-sm text-on-surface-variant">{order.enrollee.fullName}</p>
                    <AssignmentStatus order={order} />
                  </div>
                  <Link
                    href={`/aggregator/orders/${order.id}`}
                    className="bg-secondary hover:bg-secondary/90 text-on-secondary px-4 py-1.5 rounded font-semibold text-body-sm transition-colors"
                  >
                    View Order
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Completed */}
        {data?.completedOrders?.length ? (
          <section>
            <SectionHeader title="Completed Orders" />
            <div className="bg-surface-lowest border border-outline-variant rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant">
                    {['Order ID', 'Date', 'Total', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-label-caps text-on-surface-variant uppercase tracking-widest">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.completedOrders.map((order, idx) => (
                    <tr key={order.id} className={idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}>
                      <td className="px-4 py-3 font-mono text-code-mono text-on-surface">{order.intakeId}</td>
                      <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-code-mono text-on-surface">
                        ₦{order.winnerTotalPrice?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-on-surface-variant capitalize">
                          <AssignmentStatus order={order} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </AggregatorShell>
  )
}
