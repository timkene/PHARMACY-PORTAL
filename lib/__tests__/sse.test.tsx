import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderStream } from '../sse'

// Track created EventSource instances for test control
const instances: MockEventSource[] = []

class MockEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  readyState = MockEventSource.OPEN
  onopen: (() => void) | null = null
  onerror: ((e: Event) => void) | null = null
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  url: string

  constructor(url: string) {
    this.url = url
    instances.push(this)
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners[type] = [...(this.listeners[type] ?? []), cb]
  }

  close() {
    this.readyState = MockEventSource.CLOSED
  }

  emit(type: string, data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent
    ;(this.listeners[type] ?? []).forEach(cb => cb(evt))
  }

  triggerError() {
    this.readyState = MockEventSource.CLOSED
    this.onerror?.(new Event('error'))
  }
}

vi.stubGlobal('EventSource', MockEventSource)

beforeEach(() => {
  instances.length = 0
})

describe('useOrderStream', () => {
  it('connects to the correct SSE URL', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test'
    renderHook(() => useOrderStream('order-123', {}))
    expect(instances[0]?.url).toBe('http://api.test/api/orders/order-123/stream')
  })

  it('calls onBidUpdate when bid_update fires', () => {
    const onBidUpdate = vi.fn()
    renderHook(() => useOrderStream('order-1', { onBidUpdate }))
    act(() => instances[0]?.emit('bid_update', { bids: [], cheapestId: 'x' }))
    expect(onBidUpdate).toHaveBeenCalledWith({ bids: [], cheapestId: 'x' })
  })

  it('calls onSessionClosed and closes stream when session_closed fires', () => {
    const onSessionClosed = vi.fn()
    const { result } = renderHook(() => useOrderStream('order-2', { onSessionClosed }))
    act(() => instances[0]?.emit('session_closed', { winnerId: 'w1', winnerName: 'PharmaCo', totalPrice: 5000 }))
    expect(onSessionClosed).toHaveBeenCalledWith({ winnerId: 'w1', winnerName: 'PharmaCo', totalPrice: 5000 })
    expect(instances[0]?.readyState).toBe(MockEventSource.CLOSED)
  })

  it('does not connect when orderId is null', () => {
    renderHook(() => useOrderStream(null, {}))
    expect(instances).toHaveLength(0)
  })

  it('calls onReconnecting(true) on error', () => {
    vi.useFakeTimers()
    const onReconnecting = vi.fn()
    renderHook(() => useOrderStream('order-3', { onReconnecting }))
    act(() => instances[0]?.triggerError())
    expect(onReconnecting).toHaveBeenCalledWith(true)
    vi.useRealTimers()
  })
})
