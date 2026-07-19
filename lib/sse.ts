import { useEffect, useRef, useCallback } from 'react'
import type {
  BidUpdateEvent,
  SessionClosedEvent,
  OrderAcceptedEvent,
  OrderCompletedEvent,
} from './types'

const MAX_BACKOFF_MS = 30_000

interface StreamHandlers {
  onBidUpdate?: (e: BidUpdateEvent) => void
  onSessionClosed?: (e: SessionClosedEvent) => void
  onOrderAccepted?: (e: OrderAcceptedEvent) => void
  onOrderFulfilled?: () => void
  onOrderCompleted?: (e: OrderCompletedEvent) => void
  onOrderNotReceived?: () => void
  onReconnecting?: (reconnecting: boolean) => void
}

export function useOrderStream(orderId: string | null, handlers: StreamHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const backoffRef = useRef(1000)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!orderId) return

    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    const es = new EventSource(
      `${base}/api/orders/${orderId}/stream`,
      { withCredentials: true }
    )
    esRef.current = es

    es.addEventListener('bid_update', (e: MessageEvent) => {
      backoffRef.current = 1000
      handlersRef.current.onReconnecting?.(false)
      handlersRef.current.onBidUpdate?.(JSON.parse(e.data) as BidUpdateEvent)
    })

    es.addEventListener('session_closed', (e: MessageEvent) => {
      handlersRef.current.onSessionClosed?.(JSON.parse(e.data) as SessionClosedEvent)
      es.close()
    })

    es.addEventListener('order_accepted', (e: MessageEvent) => {
      handlersRef.current.onOrderAccepted?.(JSON.parse(e.data) as OrderAcceptedEvent)
    })

    es.addEventListener('order_fulfilled', () => {
      handlersRef.current.onOrderFulfilled?.()
    })

    es.addEventListener('order_completed', (e: MessageEvent) => {
      handlersRef.current.onOrderCompleted?.(JSON.parse(e.data) as OrderCompletedEvent)
      es.close()
    })

    es.addEventListener('order_not_received', () => {
      handlersRef.current.onOrderNotReceived?.()
      es.close()
    })

    es.onerror = () => {
      es.close()
      handlersRef.current.onReconnecting?.(true)
      timerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
        connect()
      }, backoffRef.current)
    }
  }, [orderId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      esRef.current?.close()
    }
  }, [connect])
}
