import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// --- Mocks ---

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/aggregator/dashboard',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const mockGetAggregatorDashboard = vi.fn()

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }
  return {
    getAggregatorDashboard: (...args: unknown[]) => mockGetAggregatorDashboard(...args),
    ApiError,
  }
})

vi.mock('@/components/shared/CountdownTimer', () => ({
  CountdownTimer: () => <div data-testid="countdown" />,
}))

vi.mock('@/components/shared/MedicationTag', () => ({
  MedicationTag: ({ med }: { med: { name: string } }) => (
    <span data-testid="med-tag">{med.name}</span>
  ),
}))

// Import after mocks are set up
import { OrderCard } from '@/components/aggregator/OrderCard'
import AggregatorDashboardPage from '@/app/aggregator/dashboard/page'
import { ApiError } from '@/lib/api'
import type { Order, AggregatorDashboard } from '@/lib/types'

// -------------------------
// Test fixtures
// -------------------------

function makeMed(name: string) {
  return { name, dosage: '500mg', quantity: 1 }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    intakeId: 'INT-001',
    enrollee: { fullName: 'Jane Doe', email: 'jane@example.com', phone: '080000', address: '1 St' },
    diagnosis: 'Hypertension',
    medications: [makeMed('Amlodipine'), makeMed('Lisinopril')],
    status: 'bidding',
    bids: [],
    biddingEndsAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// -------------------------
// OrderCard tests
// -------------------------

describe('OrderCard', () => {
  it('renders order.intakeId and order.diagnosis', () => {
    const order = makeOrder({ intakeId: 'INT-999', diagnosis: 'Diabetes Type 2' })
    render(<OrderCard order={order} />)
    expect(screen.getByText('INT-999')).toBeInTheDocument()
    expect(screen.getByText('Diabetes Type 2')).toBeInTheDocument()
  })

  it('shows first 2 medications via MedicationTag', () => {
    const order = makeOrder({
      medications: [makeMed('DrugA'), makeMed('DrugB'), makeMed('DrugC')],
    })
    render(<OrderCard order={order} />)
    const tags = screen.getAllByTestId('med-tag')
    expect(tags).toHaveLength(2)
    expect(tags[0]).toHaveTextContent('DrugA')
    expect(tags[1]).toHaveTextContent('DrugB')
  })

  it('shows "+N more" badge when medications > 2', () => {
    const order = makeOrder({
      medications: [makeMed('A'), makeMed('B'), makeMed('C'), makeMed('D')],
    })
    render(<OrderCard order={order} />)
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('does NOT show "+N more" when medications ≤ 2', () => {
    const order = makeOrder({
      medications: [makeMed('A'), makeMed('B')],
    })
    render(<OrderCard order={order} />)
    expect(screen.queryByText(/more/)).not.toBeInTheDocument()
  })

  it('renders "View & Bid" link to /aggregator/orders/{order.id}', () => {
    const order = makeOrder({ id: 'order-42' })
    render(<OrderCard order={order} />)
    const link = screen.getByRole('link', { name: /view & bid/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/aggregator/orders/order-42')
  })
})

// -------------------------
// AggregatorDashboardPage tests
// -------------------------

describe('AggregatorDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows 2 skeleton placeholders while loading', () => {
    // Never resolves during this test — stays in loading state
    mockGetAggregatorDashboard.mockReturnValue(new Promise(() => {}))
    render(<AggregatorDashboardPage />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(2)
  })

  it('calls getAggregatorDashboard on mount', async () => {
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: [],
      wonOrders: [],
      completedOrders: [],
    } satisfies AggregatorDashboard)
    render(<AggregatorDashboardPage />)
    await waitFor(() => expect(mockGetAggregatorDashboard).toHaveBeenCalledOnce())
  })

  it('renders OrderCard for each open session', async () => {
    const sessions = [
      makeOrder({ id: 'o1', intakeId: 'INT-001' }),
      makeOrder({ id: 'o2', intakeId: 'INT-002' }),
    ]
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: sessions,
      wonOrders: [],
      completedOrders: [],
    })
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('INT-001')).toBeInTheDocument()
      expect(screen.getByText('INT-002')).toBeInTheDocument()
    })
  })

  it('shows empty-state text when openSessions is empty', async () => {
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: [],
      wonOrders: [],
      completedOrders: [],
    })
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      expect(screen.getByText(/no active sessions right now/i)).toBeInTheDocument()
    })
  })

  it('shows "Your Active Orders" section and "Verify Collection" link when wonOrders has items', async () => {
    const won = makeOrder({ id: 'won-1', intakeId: 'INT-WON' })
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: [],
      wonOrders: [won],
      completedOrders: [],
    })
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('Your Active Orders')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /verify collection/i })
      expect(link).toHaveAttribute('href', '/aggregator/orders/won-1')
    })
  })

  it('hides won orders section when wonOrders is empty', async () => {
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: [],
      wonOrders: [],
      completedOrders: [],
    })
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      expect(screen.queryByText('Your Active Orders')).not.toBeInTheDocument()
    })
  })

  it('renders completed orders table with intakeId, date, total, approval code', async () => {
    const completed = makeOrder({
      id: 'comp-1',
      intakeId: 'INT-COMP',
      createdAt: '2025-01-15T10:00:00.000Z',
      winnerTotalPrice: 12500,
      approvalCode: 'APR-999',
    })
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: [],
      wonOrders: [],
      completedOrders: [completed],
    })
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('INT-COMP')).toBeInTheDocument()
      expect(screen.getByText('APR-999')).toBeInTheDocument()
      expect(screen.getByText(/12,500/)).toBeInTheDocument()
    })
  })

  it('shows "—" for missing approvalCode', async () => {
    const completed = makeOrder({
      id: 'comp-2',
      intakeId: 'INT-NO-APR',
      winnerTotalPrice: 5000,
      approvalCode: undefined,
    })
    mockGetAggregatorDashboard.mockResolvedValue({
      openSessions: [],
      wonOrders: [],
      completedOrders: [completed],
    })
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      // Should render a dash for missing approval code (the span with text "—")
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows Toast with error message on API failure', async () => {
    mockGetAggregatorDashboard.mockRejectedValue(new ApiError(500, 'Server exploded'))
    render(<AggregatorDashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('Server exploded')).toBeInTheDocument()
    })
  })
})
