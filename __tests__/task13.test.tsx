import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Order } from '@/lib/types'

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'order-1' }) }))
vi.mock('@/components/aggregator/AggregatorShell', () => ({
  AggregatorShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/shared/CountdownTimer', () => ({ CountdownTimer: () => <span>Countdown</span> }))
vi.mock('@/lib/sse', () => ({ useOrderStream: vi.fn() }))
vi.mock('@/lib/api', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  getOrder: vi.fn(), submitDirectQuote: vi.fn(), acceptOrder: vi.fn(), fulfillOrder: vi.fn(), placeBid: vi.fn(),
}))
import OrderPage from '@/app/aggregator/orders/[id]/page'
import { getOrder, submitDirectQuote, acceptOrder, fulfillOrder, placeBid, ApiError } from '@/lib/api'
import { useOrderStream } from '@/lib/sse'

const medication = { name: 'Synthetic medicine', dosage: '5mg', quantity: 2, tablets: 1, frequency: '' as const, durationDays: 1, diagnosis: 'Synthetic diagnosis' }
function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1', intakeId: 'TEST-1', enrollee: { enrolleeId: 'EN-1', fullName: 'Synthetic Patient' },
    medications: [medication], bids: [], createdAt: '2026-01-01', assignmentType: 'direct',
    status: 'direct_quote_requested', version: 4, assignmentVersion: 1, ...overrides,
  }
}
function response(value: Order) { return { order: value, bids: value.bids, status: value.status } }
function serve(value: Order) { vi.mocked(getOrder).mockResolvedValue(response(value)) }
function stream() { return vi.mocked(useOrderStream).mock.calls.at(-1)![1] }
async function show(value = order()) {
  serve(value)
  render(<OrderPage />)
  await screen.findByText('TEST-1')
}
function quote(value = '1250.50') {
  fireEvent.change(screen.getByLabelText('Total Price / Cost (₦)'), { target: { value } })
  fireEvent.submit(screen.getByRole('button', { name: 'Submit Price' }).closest('form')!)
}
const approved = () => order({ status: 'awaiting_fulfillment', winnerTotalPrice: 1200, priceApprovedAt: '2026-01-01' })

beforeEach(() => { vi.resetAllMocks() })

describe('aggregator direct assignment', () => {
  it('renders an order-level price form without competitive bid fields or Accept', async () => {
    await show()
    expect(screen.getByText('Direct Assignment')).toBeInTheDocument()
    expect(screen.getByLabelText('Total Price / Cost (₦)')).toBeRequired()
    expect(screen.queryByText('Place Your Bid')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept Order' })).not.toBeInTheDocument()
  })

  it('submits totalPrice and order version once, then refetches the waiting state', async () => {
    await show()
    let resolve!: (value: Awaited<ReturnType<typeof submitDirectQuote>>) => void
    vi.mocked(submitDirectQuote).mockImplementation(() => new Promise(r => { resolve = r }))
    quote()
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('button', { name: 'Submitting…' }).closest('form')!)
    expect(submitDirectQuote).toHaveBeenCalledExactlyOnceWith('order-1', { totalPrice: 1250.5, expectedVersion: 4 })
    serve(order({ status: 'direct_price_review', version: 5, directQuote: { totalPrice: 1250.5, submittedAt: '2026-01-01', aggregatorId: 'A', assignmentVersion: 1 } }))
    await act(async () => resolve({ success: true, status: 'direct_price_review', version: 5, assignmentVersion: 1 }))
    await screen.findByText(/Submitted price: ₦1,250.5/)
    expect(getOrder).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'Submit Price' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept Order' })).not.toBeInTheDocument()
  })

  it.each(['0', '-1', '', 'invalid', 'Infinity', '1e309'])('blocks invalid price %s', async value => {
    await show()
    quote(value)
    expect(submitDirectQuote).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a total price greater than zero.')).toBeInTheDocument()
  })

  it('shows submitted quote and a waiting state without editable actions', async () => {
    await show(order({ status: 'direct_price_review', directQuote: { totalPrice: 999, submittedAt: '2026-01-01', aggregatorId: 'A', assignmentVersion: 1 } }))
    expect(screen.getByText('Price submitted — awaiting Clearline approval')).toBeInTheDocument()
    expect(screen.getByText('Submitted price: ₦999')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Accept|Fulfil|Submit/ })).not.toBeInTheDocument()
  })

  it('accepts with current version and fulfils with the newly fetched version', async () => {
    await show(approved())
    serve(order({ status: 'accepted', version: 5 }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Order' }))
    await screen.findByText('Order Accepted')
    expect(acceptOrder).toHaveBeenCalledExactlyOnceWith('order-1', { expectedVersion: 4 })
    expect(getOrder).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: /Picked Up/ }))
    serve(order({ status: 'completed', version: 6 }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Picked Up' }))
    await screen.findByText('Order Completed')
    expect(fulfillOrder).toHaveBeenCalledExactlyOnceWith('order-1', 'picked_up', undefined, { expectedVersion: 5 })
    expect(getOrder).toHaveBeenCalledTimes(3)
  })

  it('blocks duplicate Accept while pending', async () => {
    await show(approved())
    vi.mocked(acceptOrder).mockReturnValue(new Promise(() => {}))
    const button = screen.getByRole('button', { name: 'Accept Order' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(acceptOrder).toHaveBeenCalledTimes(1)
  })

  it('supports legacy accepted direct orders with version zero and a positive delivery fee; blocks duplicate fulfilment', async () => {
    await show(order({ status: 'accepted', version: undefined }))
    fireEvent.click(screen.getByRole('button', { name: /Delivered/ }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } })
    vi.mocked(fulfillOrder).mockReturnValue(new Promise(() => {}))
    const button = screen.getByRole('button', { name: 'Confirm Delivered' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(fulfillOrder).toHaveBeenCalledExactlyOnceWith('order-1', 'delivered', 50, { expectedVersion: 0 })
  })

  it('does not accept legacy direct orders without explicit approval', async () => {
    await show(order({ status: 'awaiting_fulfillment', winnerTotalPrice: 500 }))
    expect(screen.queryByRole('button', { name: 'Accept Order' })).not.toBeInTheDocument()
    expect(screen.getByText(/needs Clearline price approval/)).toBeInTheDocument()
  })

  it('refreshes on 409 without replay and requires a new user action', async () => {
    await show()
    vi.mocked(submitDirectQuote).mockRejectedValue(new ApiError(409, 'Conflict'))
    serve(order({ version: 8 }))
    quote()
    await screen.findByText('This order changed. Review the refreshed order before trying again.')
    await waitFor(() => expect(getOrder).toHaveBeenCalledTimes(2))
    expect(submitDirectQuote).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Price' })).toBeEnabled())
    quote('2000')
    await waitFor(() => expect(submitDirectQuote).toHaveBeenLastCalledWith('order-1', { totalPrice: 2000, expectedVersion: 8 }))
  })

  it.each([403, 404])('clears prescription and controls on mutation HTTP %s', async code => {
    await show()
    vi.mocked(submitDirectQuote).mockRejectedValue(new ApiError(code, 'Private staff reason'))
    quote()
    await screen.findByText('Assignment no longer available.')
    expect(screen.queryByText('Synthetic Patient')).not.toBeInTheDocument()
    expect(screen.queryByText('Private staff reason')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it.each(['direct_reassignment', 'cancelled', 'post_fulfilment_recalled'] as const)('leaves no actions for %s', async status => {
    serve(order({ status }))
    render(<OrderPage />)
    await screen.findByText(/no longer (available|active)/)
    expect(screen.queryByRole('button', { name: /Accept|Submit Price|Confirm|Picked Up|Delivered/ })).not.toBeInTheDocument()
  })

  it('clears on access_revoked and ignores an older in-flight GET', async () => {
    await show()
    let resolve!: (value: Awaited<ReturnType<typeof getOrder>>) => void
    vi.mocked(getOrder).mockImplementation(() => new Promise(r => { resolve = r }))
    act(() => stream().onOrderChanged?.())
    act(() => stream().onAccessRevoked?.())
    await screen.findByText('Assignment no longer available.')
    await act(async () => resolve(response(approved())))
    expect(screen.queryByText('Synthetic Patient')).not.toBeInTheDocument()
    expect(vi.mocked(useOrderStream).mock.calls.at(-1)![0]).toBeNull()
  })

  it('refetches approval on order_changed and refreshes on focus', async () => {
    await show(order({ status: 'direct_price_review' }))
    serve(approved())
    act(() => stream().onOrderChanged?.())
    await screen.findByRole('button', { name: 'Accept Order' })
    serve(order({ status: 'direct_reassignment' }))
    fireEvent(window, new Event('focus'))
    await screen.findByText('Assignment no longer available.')
  })

  it('leaves actions disabled when post-mutation refresh fails', async () => {
    await show(approved())
    vi.mocked(getOrder).mockRejectedValue(new ApiError(503, 'Service unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Order' }))
    await screen.findByText('Service unavailable')
    expect(screen.getByRole('button', { name: 'Accept Order' })).toBeDisabled()
    expect(acceptOrder).toHaveBeenCalledTimes(1)
  })
})

describe('competitive compatibility', () => {
  it.each(['competitive', undefined] as const)('keeps the existing medication bid form for assignmentType %s', async assignmentType => {
    await show(order({ assignmentType, status: 'bidding', enrollee: { enrolleeId: '', fullName: 'Hidden' } }))
    expect(screen.getByText('Place Your Bid')).toBeInTheDocument()
    expect(screen.queryByText('Direct Assignment')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))
    await screen.findByText('Bid Submitted')
    expect(placeBid).toHaveBeenCalledExactlyOnceWith('order-1', 500)
    expect(submitDirectQuote).not.toHaveBeenCalled()
  })

  it('keeps competitive acceptance and fulfilment calls without expectedVersion', async () => {
    await show(order({ assignmentType: 'competitive', status: 'awaiting_fulfillment' }))
    serve(order({ assignmentType: 'competitive', status: 'accepted' }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept Order' }))
    await screen.findByText('Order Accepted')
    expect(acceptOrder).toHaveBeenCalledExactlyOnceWith('order-1')
    fireEvent.click(screen.getByRole('button', { name: /Picked Up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Picked Up' }))
    await waitFor(() => expect(fulfillOrder).toHaveBeenCalledExactlyOnceWith('order-1', 'picked_up', undefined))
  })
})
