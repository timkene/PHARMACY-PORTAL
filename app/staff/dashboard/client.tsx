'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { StaffShell } from '@/components/staff/StaffShell'
import { StatusChip } from '@/components/shared/StatusChip'
import { Toast } from '@/components/shared/Toast'
import { getOrders, deleteOrder, ApiError } from '@/lib/api'
import type { Order, OrderStatus } from '@/lib/types'

const PAGE_SIZE = 20

const STATUS_CHIP_MAP: Record<OrderStatus, { status: 'active' | 'pending' | 'error' | 'info'; label: string }> = {
  bidding:               { status: 'active',  label: 'Bidding' },
  awaiting_fulfillment:  { status: 'pending', label: 'Awaiting Acceptance' },
  accepted:              { status: 'info',    label: 'Accepted' },
  awaiting_confirmation: { status: 'pending', label: 'Confirming Receipt' },
  completed:             { status: 'active',  label: 'Completed' },
  not_received:          { status: 'error',   label: 'Not Received' },
}

const TABLE_HEADERS = ['Intake ID', 'Enrollee', 'Diagnosis', 'Medications', 'Status', 'Time', 'Action']

function SkeletonRow() {
  return (
    <tr>
      {TABLE_HEADERS.map(h => (
        <td key={h} className="px-4 py-3">
          <div className="h-4 bg-surface-container rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-surface-lowest border border-outline-variant rounded p-6">
      <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <p className="text-headline-lg font-semibold text-on-surface">{value}</p>
    </div>
  )
}

interface StaffDashboardClientProps {
  userName: string
}

export function StaffDashboardClient({ userName }: StaffDashboardClientProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string, intakeId: string) => {
    if (!window.confirm(`Delete order ${intakeId}? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await deleteOrder(id)
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to delete order')
    } finally {
      setDeleting(null)
    }
  }

  const load = useCallback(async () => {
    try {
      const { orders: data } = await getOrders()
      setOrders(data)
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll every 20 s — keeps status chips and stats live without SSE on the list
  useEffect(() => {
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [load])

  const today = new Date().toDateString()
  const activeBidding = orders.filter(o => o.status === 'bidding').length
  const awaitingFulfillment = orders.filter(o => o.status === 'awaiting_fulfillment').length
  const completedToday = orders.filter(o => {
    if (o.status !== 'completed' && o.status !== 'not_received') return false
    const stamp = o.completedAt ?? o.createdAt
    return new Date(stamp.endsWith('Z') ? stamp : stamp + 'Z').toDateString() === today
  }).length

  const totalPages = Math.ceil(orders.length / PAGE_SIZE)
  const paged = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <StaffShell userName={userName}>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-headline-lg font-semibold text-on-surface">Dashboard</h1>
          <Link
            href="/staff/intake/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded font-semibold text-body-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Intake
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Active Bidding"       value={loading ? '—' : activeBidding} />
          <StatCard label="Awaiting Fulfillment" value={loading ? '—' : awaitingFulfillment} />
          <StatCard label="Completed Today"      value={loading ? '—' : completedToday} />
        </div>

        {/* Orders table */}
        <div className="bg-surface-lowest border border-outline-variant rounded overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h2 className="text-title-md font-semibold text-on-surface">Recent Orders</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant">
                  {TABLE_HEADERS.map(h => (
                    <th key={h} className="px-4 py-3 text-left text-label-caps text-on-surface-variant uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                  : paged.map((order, idx) => {
                      const chip = STATUS_CHIP_MAP[order.status] ?? { status: 'info' as const, label: order.status }
                      const meds = order.medications ?? []
                      return (
                        <tr
                          key={order.id}
                          className={idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}
                        >
                          <td className="px-4 py-3 font-mono text-code-mono text-on-surface">{order.intakeId}</td>
                          <td className="px-4 py-3 text-body-sm text-on-surface">{order.enrollee.fullName}</td>
                          <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                            {meds.map(m => m.diagnosis).filter(Boolean).join(', ') || order.diagnosis || '—'}
                          </td>
                          <td className="px-4 py-3 text-body-sm text-on-surface-variant">{meds.length}</td>
                          <td className="px-4 py-3"><StatusChip status={chip.status} label={chip.label} /></td>
                          <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/staff/orders/${order.id}`}
                                className="text-body-sm text-primary hover:underline font-semibold"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => handleDelete(order.id, order.intakeId)}
                                disabled={deleting === order.id}
                                className="text-body-sm text-error hover:underline font-semibold disabled:opacity-40"
                              >
                                {deleting === order.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                }
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-body-sm text-on-surface-variant">
                      No orders yet.{' '}
                      <Link href="/staff/intake/new" className="text-primary hover:underline">
                        Create the first intake.
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant">
              <p className="text-body-sm text-on-surface-variant">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded border border-outline-variant text-body-sm disabled:opacity-40 hover:bg-surface-low transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="px-3 py-1 rounded border border-outline-variant text-body-sm disabled:opacity-40 hover:bg-surface-low transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  )
}
