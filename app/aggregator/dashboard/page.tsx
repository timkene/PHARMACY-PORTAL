'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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

  const load = useCallback(async () => {
    try {
      const d = await getAggregatorDashboard()
      setData(d)
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <AggregatorShell companyName="Your Pharmacy">
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <div className="p-8 space-y-10">
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
                  </div>
                  <Link
                    href={`/aggregator/orders/${order.id}`}
                    className="bg-secondary hover:bg-secondary/90 text-on-secondary px-4 py-1.5 rounded font-semibold text-body-sm transition-colors"
                  >
                    Verify Collection
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
                    {['Order ID', 'Date', 'Total', 'Approval Code'].map(h => (
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
                        {order.approvalCode
                          ? <span className="font-mono text-code-mono bg-surface-container px-2 py-0.5 rounded">{order.approvalCode}</span>
                          : <span className="text-body-sm text-on-surface-variant">—</span>}
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
