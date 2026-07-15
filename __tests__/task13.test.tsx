import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// --- Mocks ---

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'order-1' }),
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/aggregator/orders/order-1',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const mockPlaceBid = vi.fn()
const mockVerifyCollection = vi.fn()
const mockGetOrder = vi.fn()
const mockLogout = vi.fn()

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
    placeBid: (...args: unknown[]) => mockPlaceBid(...args),
    verifyCollection: (...args: unknown[]) => mockVerifyCollection(...args),
    getOrder: (...args: unknown[]) => mockGetOrder(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    ApiError,
  }
})

vi.mock('@/lib/sse', () => ({
  useOrderStream: vi.fn(),
}))

vi.mock('@/components/staff/BiddingTable', () => ({
  BiddingTable: () => <div data-testid="bidding-table" />,
}))

vi.mock('@/components/shared/CountdownTimer', () => ({
  CountdownTimer: () => <div data-testid="countdown-timer" />,
}))

vi.mock('@/components/shared/MedicationTag', () => ({
  MedicationTag: ({ med }: { med: { name: string } }) => (
    <span data-testid="med-tag">{med.name}</span>
  ),
}))

vi.mock('@/components/shared/CodeWidget', () => ({
  CodeWidget: ({ code }: { code: string; label: string }) => (
    <div data-testid="code-widget">{code}</div>
  ),
}))

// Import after mocks are set up
import { BidForm } from '@/components/aggregator/BidForm'
import { CollectionVerifier } from '@/components/aggregator/CollectionVerifier'
import AggregatorOrderPage from '@/app/aggregator/orders/[id]/page'
import { ApiError } from '@/lib/api'
import type { Order } from '@/lib/types'

// ---- Fixtures ----

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    intakeId: 'INT-001',
    enrollee: {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '0800000',
      address: '1 St',
    },
    diagnosis: 'Hypertension',
    medications: [
      { name: 'Amlodipine', dosage: '5mg', quantity: 1 },
      { name: 'Lisinopril', dosage: '10mg', quantity: 1 },
    ],
    status: 'bidding',
    bids: [],
    biddingEndsAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeGetOrderResponse(orderOverrides: Partial<Order> = {}) {
  const order = makeOrder(orderOverrides)
  return {
    order,
    bids: [],
    status: order.status,
  }
}

// ---- BidForm tests ----

describe('BidForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders unit price and total price fields', () => {
    render(<BidForm orderId="order-1" />)
    expect(screen.getByLabelText(/unit price per medication/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/total aggregate price/i)).toBeInTheDocument()
  })

  it('calls placeBid(orderId, unitPrice, totalPrice) on submit with numeric values', async () => {
    mockPlaceBid.mockResolvedValue(undefined)
    render(<BidForm orderId="order-99" />)

    fireEvent.change(screen.getByLabelText(/unit price per medication/i), {
      target: { value: '500' },
    })
    fireEvent.change(screen.getByLabelText(/total aggregate price/i), {
      target: { value: '15000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit bid/i }))

    await waitFor(() => {
      expect(mockPlaceBid).toHaveBeenCalledWith('order-99', 500, 15000)
    })
  })

  it('shows "Bid Submitted" confirmation with formatted total after success', async () => {
    mockPlaceBid.mockResolvedValue(undefined)
    render(<BidForm orderId="order-1" />)

    fireEvent.change(screen.getByLabelText(/unit price per medication/i), {
      target: { value: '250' },
    })
    fireEvent.change(screen.getByLabelText(/total aggregate price/i), {
      target: { value: '15000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit bid/i }))

    await waitFor(() => {
      expect(screen.getByText('Bid Submitted')).toBeInTheDocument()
      expect(screen.getByText(/15,000/)).toBeInTheDocument()
    })
  })

  it('"Update Bid" button re-shows the form', async () => {
    mockPlaceBid.mockResolvedValue(undefined)
    render(<BidForm orderId="order-1" />)

    fireEvent.change(screen.getByLabelText(/unit price per medication/i), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText(/total aggregate price/i), {
      target: { value: '5000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit bid/i }))

    await waitFor(() => {
      expect(screen.getByText('Bid Submitted')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Update Bid'))
    expect(screen.getByRole('button', { name: /submit bid/i })).toBeInTheDocument()
  })

  it('shows ApiError message on failure with role="alert"', async () => {
    mockPlaceBid.mockRejectedValue(new ApiError(400, 'Bid window has closed'))
    render(<BidForm orderId="order-1" />)

    fireEvent.change(screen.getByLabelText(/unit price per medication/i), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText(/total aggregate price/i), {
      target: { value: '5000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit bid/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Bid window has closed')
    })
  })

  it('shows "Bidding has ended" when disabled={true}', () => {
    render(<BidForm orderId="order-1" disabled={true} />)
    expect(screen.getByText(/bidding has ended for this session/i)).toBeInTheDocument()
  })
})

// ---- CollectionVerifier tests ----

describe('CollectionVerifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the code input and submit button', () => {
    render(<CollectionVerifier orderId="order-1" />)
    expect(screen.getByPlaceholderText('XXX-XXX')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /verify & mark as fulfilled/i })
    ).toBeInTheDocument()
  })

  it('calls verifyCollection(orderId, code.toUpperCase()) on submit', async () => {
    mockVerifyCollection.mockResolvedValue(undefined)
    render(<CollectionVerifier orderId="order-77" />)

    fireEvent.change(screen.getByPlaceholderText('XXX-XXX'), {
      target: { value: 'abc123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify & mark as fulfilled/i }))

    await waitFor(() => {
      expect(mockVerifyCollection).toHaveBeenCalledWith('order-77', 'ABC123')
    })
  })

  it('shows "Verified — HMO has been notified." on success', async () => {
    mockVerifyCollection.mockResolvedValue(undefined)
    render(<CollectionVerifier orderId="order-1" />)

    fireEvent.change(screen.getByPlaceholderText('XXX-XXX'), {
      target: { value: 'XYZ999' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify & mark as fulfilled/i }))

    await waitFor(() => {
      expect(screen.getByText(/verified — hmo has been notified/i)).toBeInTheDocument()
    })
  })

  it('shows "Invalid code. Please check with the enrollee." when ApiError with status 400', async () => {
    mockVerifyCollection.mockRejectedValue(new ApiError(400, 'Invalid code'))
    render(<CollectionVerifier orderId="order-1" />)

    fireEvent.change(screen.getByPlaceholderText('XXX-XXX'), {
      target: { value: 'WRONG1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify & mark as fulfilled/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid code. Please check with the enrollee.'
      )
    })
  })

  it('shows "Verification failed. Try again." on non-400 error', async () => {
    mockVerifyCollection.mockRejectedValue(new ApiError(500, 'Server error'))
    render(<CollectionVerifier orderId="order-1" />)

    fireEvent.change(screen.getByPlaceholderText('XXX-XXX'), {
      target: { value: 'FAIL01' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify & mark as fulfilled/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Verification failed. Try again.')
    })
  })

  it('shows CodeWidget with approvalCode when approvalCode prop is set', () => {
    render(<CollectionVerifier orderId="order-1" approvalCode="APR-789" />)
    expect(screen.getByTestId('code-widget')).toBeInTheDocument()
    expect(screen.getByTestId('code-widget')).toHaveTextContent('APR-789')
  })

  it('does NOT render CodeWidget when approvalCode is undefined', () => {
    render(<CollectionVerifier orderId="order-1" />)
    expect(screen.queryByTestId('code-widget')).not.toBeInTheDocument()
  })
})

// ---- AggregatorOrderPage tests ----

describe('AggregatorOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows skeleton while loading', () => {
    mockGetOrder.mockReturnValue(new Promise(() => {})) // never resolves
    render(<AggregatorOrderPage />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('calls getOrder(id) on mount', async () => {
    mockGetOrder.mockResolvedValue(makeGetOrderResponse())
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(mockGetOrder).toHaveBeenCalledWith('order-1')
    })
  })

  it('renders prescription summary (intakeId, enrollee name, diagnosis)', async () => {
    mockGetOrder.mockResolvedValue(
      makeGetOrderResponse({
        intakeId: 'INT-555',
        enrollee: {
          fullName: 'John Smith',
          email: 'j@test.com',
          phone: '0800',
          address: '1 St',
        },
        diagnosis: 'Type 2 Diabetes',
      })
    )
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByText('INT-555')).toBeInTheDocument()
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument()
    })
  })

  it('shows countdown banner and BidForm when status is bidding', async () => {
    mockGetOrder.mockResolvedValue(makeGetOrderResponse({ status: 'bidding' }))
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument()
      expect(screen.getByText(/place your bid/i)).toBeInTheDocument()
    })
  })

  it('shows "You Were Selected" banner when bidClosed and isWinner', async () => {
    mockGetOrder.mockResolvedValue({
      order: makeOrder({
        status: 'awaiting_fulfillment',
        winnerId: 'agg-1',
        winnerName: 'BestPharm',
        winnerTotalPrice: 20000,
      }),
      bids: [],
      status: 'awaiting_fulfillment',
    })
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByText('You Were Selected')).toBeInTheDocument()
    })
  })

  it('shows "Session Closed" banner when bidClosed and not winner', async () => {
    mockGetOrder.mockResolvedValue({
      order: makeOrder({ status: 'awaiting_fulfillment', winnerTotalPrice: 20000 }),
      bids: [],
      status: 'awaiting_fulfillment',
    })
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByText('Session Closed')).toBeInTheDocument()
    })
  })

  it('shows CollectionVerifier when status is awaiting_fulfillment and isWinner', async () => {
    mockGetOrder.mockResolvedValue({
      order: makeOrder({
        status: 'awaiting_fulfillment',
        winnerId: 'agg-1',
        winnerName: 'BestPharm',
      }),
      bids: [],
      status: 'awaiting_fulfillment',
    })
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByText(/aggregator verification/i)).toBeInTheDocument()
    })
  })

  it('does NOT show CollectionVerifier when not winner', async () => {
    mockGetOrder.mockResolvedValue({
      order: makeOrder({ status: 'awaiting_fulfillment' }),
      bids: [],
      status: 'awaiting_fulfillment',
    })
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByText('Session Closed')).toBeInTheDocument()
    })
    expect(screen.queryByText(/aggregator verification/i)).not.toBeInTheDocument()
  })

  it('shows Toast on API load error', async () => {
    mockGetOrder.mockRejectedValue(new ApiError(500, 'Order not found'))
    render(<AggregatorOrderPage />)
    await waitFor(() => {
      expect(screen.getByText('Order not found')).toBeInTheDocument()
    })
  })
})
