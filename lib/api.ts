import type {
  StaffUser,
  AggregatorUser,
  Order,
  Bid,
  OrderStatus,
  Enrollee,
  Medication,
  AggregatorDashboard,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { message?: string }).message ?? `HTTP ${res.status}`)
  return data as T
}

// Auth
export const staffLogin = (email: string, password: string) =>
  apiFetch<{ user: StaffUser }>('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const aggregatorLogin = (email: string, password: string) =>
  apiFetch<{ user: AggregatorUser }>('/api/auth/aggregator/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const aggregatorSignup = (payload: {
  companyName: string
  contactName: string
  email: string
  phone: string
  password: string
}) =>
  apiFetch<{ user: AggregatorUser }>('/api/auth/aggregator/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const logout = () =>
  apiFetch<void>('/api/auth/logout', { method: 'POST' })

// Staff — Orders
export const createOrder = (payload: {
  enrollee: Enrollee
  diagnosis: string
  medications: Medication[]
}) =>
  apiFetch<{ orderId: string }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getOrders = () =>
  apiFetch<{ orders: Order[] }>('/api/orders')

export const getOrder = (id: string) =>
  apiFetch<{ order: Order; bids: Bid[]; status: OrderStatus }>(`/api/orders/${id}`)

export const generateApproval = (id: string) =>
  apiFetch<{ approvalCode: string }>(`/api/orders/${id}/generate-approval`, {
    method: 'POST',
  })

// Aggregator
export const getAggregatorDashboard = () =>
  apiFetch<AggregatorDashboard>('/api/aggregator/orders')

export const placeBid = (orderId: string, unitPrice: number, totalPrice: number) =>
  apiFetch<{ bid: Bid }>(`/api/orders/${orderId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ unitPrice, totalPrice }),
  })

export const verifyCollection = (orderId: string, collectionCode: string) =>
  apiFetch<{ ok: boolean }>(`/api/orders/${orderId}/verify-collection`, {
    method: 'POST',
    body: JSON.stringify({ collectionCode }),
  })
