import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Order } from '@/lib/types'
vi.mock('@/components/aggregator/AggregatorShell', () => ({ AggregatorShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/shared/CountdownTimer', () => ({ CountdownTimer: () => <span>Countdown</span> }))
vi.mock('@/lib/api', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/api')>(), getAggregatorDashboard: vi.fn(), getAggregatorOrders: vi.fn(),
}))
import Dashboard from '@/app/aggregator/dashboard/page'
import Orders from '@/app/aggregator/orders/page'
import { getAggregatorDashboard, getAggregatorOrders } from '@/lib/api'

const direct: Order = { id: 'synthetic-direct', intakeId: 'DIRECT-1', assignmentType: 'direct', status: 'direct_quote_requested', version: 1, medications: [], bids: [], enrollee: { enrolleeId: 'EN-1', fullName: 'Synthetic' }, createdAt: '2026-01-01' }
beforeEach(() => vi.resetAllMocks())

it('derives direct workload counts from authorized wonOrders and keeps competitive bidding separate', async () => {
  vi.mocked(getAggregatorDashboard).mockResolvedValue({
    openSessions: [{ ...direct, id: 'bid', intakeId: 'BID-1', assignmentType: 'competitive', status: 'bidding' }],
    wonOrders: [direct, { ...direct, id: 'review', intakeId: 'REVIEW-1', status: 'direct_price_review' }], completedOrders: [],
  })
  render(<Dashboard />)
  await screen.findByText('Direct Assignments')
  expect(screen.getByText(/1 awaiting price submission/)).toHaveTextContent('1 awaiting price submission · 1 awaiting Clearline approval')
  expect(screen.getAllByRole('link', { name: 'View & Bid' })).toHaveLength(1)
  expect(screen.getByText('Direct • Price Required')).toBeInTheDocument()
  expect(screen.getByText('Direct • Awaiting Clearline Approval')).toBeInTheDocument()
})

it('removes revoked direct assignments from dashboard on focus refresh', async () => {
  vi.mocked(getAggregatorDashboard).mockResolvedValue({ openSessions: [], wonOrders: [direct], completedOrders: [] })
  render(<Dashboard />)
  await screen.findByText('DIRECT-1')
  vi.mocked(getAggregatorDashboard).mockResolvedValue({ openSessions: [], wonOrders: [], completedOrders: [] })
  fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.queryByText('DIRECT-1')).not.toBeInTheDocument())
})

it('shows direct active labels and terminal history statuses; removes revoked active rows after refresh', async () => {
  const data = { open: [], active: [direct], fulfilled: [{ ...direct, id: 'cancelled', intakeId: 'CANCELLED-1', status: 'cancelled' as const }], counts: { open: 0, active: 1, fulfilled: 1 } }
  vi.mocked(getAggregatorOrders).mockResolvedValue(data)
  render(<Orders />)
  fireEvent.click(screen.getByRole('button', { name: /^Active/ }))
  await screen.findByText('Direct • Price Required')
  fireEvent.click(screen.getByRole('button', { name: /^Fulfilled/ }))
  expect(screen.getByText('Direct • Cancelled')).toBeInTheDocument()
  vi.mocked(getAggregatorOrders).mockResolvedValue({ ...data, active: [], counts: { ...data.counts, active: 0 } })
  await act(async () => { fireEvent(window, new Event('focus')) })
  fireEvent.click(screen.getByRole('button', { name: /^Active/ }))
  expect(screen.getByText('No active orders.')).toBeInTheDocument()
})
