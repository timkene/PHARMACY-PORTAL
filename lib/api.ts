import type {
  StaffUser,
  AggregatorUser,
  Order,
  Bid,
  OrderStatus,
  Enrollee,
  Medication,
  Provider,
  AggregatorDashboard,
  AggregatorOrdersResponse,
  SearchResult,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://pharmacy-dispatch-api.onrender.com'

function setDomainCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; SameSite=Lax`
}

function clearDomainCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

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
export const staffLogin = async (email: string, password: string) => {
  const data = await apiFetch<{ user: StaffUser; session: string }>('/api/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setDomainCookie('staff_session', data.session)
  return data
}

export const aggregatorLogin = async (email: string, password: string) => {
  const data = await apiFetch<{ user: AggregatorUser; session: string }>('/api/auth/aggregator/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setDomainCookie('aggregator_session', data.session)
  return data
}

export const aggregatorSignup = async (payload: {
  companyName: string
  contactName: string
  email: string
  phone: string
  password: string
}) => {
  const data = await apiFetch<{ user?: AggregatorUser; session: string }>('/api/auth/aggregator/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setDomainCookie('aggregator_session', data.session)
  return data
}

export const logout = async () => {
  const result = await apiFetch<void>('/api/auth/logout', { method: 'POST' })
  clearDomainCookie('staff_session')
  clearDomainCookie('aggregator_session')
  return result
}

// Staff — Orders
export const createOrder = (payload: {
  enrollee: Enrollee
  provider: Provider
  medications: Medication[]
}) =>
  apiFetch<{ orderId: string }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const getOrders = () =>
  apiFetch<{ orders: Order[] }>('/api/orders')

export const deleteOrder = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/orders/${id}`, { method: 'DELETE' })

export const getOrder = async (id: string): Promise<{ order: Order; bids: Bid[]; status: OrderStatus }> => {
  const order = await apiFetch<Order>(`/api/orders/${id}`)
  return { order, bids: order.bids ?? [], status: order.status }
}

// Aggregator actions
export const acceptOrder = (orderId: string) =>
  apiFetch<{ success: boolean }>(`/api/orders/${orderId}/accept`, { method: 'POST' })

export const fulfillOrder = (
  orderId: string,
  fulfillmentType: 'delivered' | 'picked_up',
  deliveryFee?: number
) =>
  apiFetch<{ success: boolean }>(`/api/orders/${orderId}/fulfill`, {
    method: 'POST',
    body: JSON.stringify({ fulfillmentType, deliveryFee }),
  })

export const getAggregatorDashboard = () =>
  apiFetch<AggregatorDashboard>('/api/aggregator/dashboard')

export const getAggregatorOrders = () =>
  apiFetch<AggregatorOrdersResponse>('/api/aggregator/orders')

export const placeBid = (orderId: string, unitPrice: number, totalPrice: number) =>
  apiFetch<{ bid: Bid }>(`/api/orders/${orderId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ unitPrice, totalPrice }),
  })

// Search — uses pharmacy backend (has MotherDuck)
const nhiaSearch = (path: string) => async (q: string): Promise<SearchResult[]> => {
  try {
    const res = await fetch(`https://clearline-nhia-api.onrender.com${path}?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.results as SearchResult[]) ?? []
  } catch {
    return []
  }
}

export const searchMembers    = nhiaSearch('/api/search/members')
export const searchProviders  = nhiaSearch('/api/search/providers')
export const searchProcedures = nhiaSearch('/api/search/procedures')
export const searchDiagnoses  = nhiaSearch('/api/search/diagnoses')

export const getMemberDetail = async (enrolleeId: string): Promise<{ phone: string | null; address: string | null }> => {
  try {
    return await apiFetch<{ phone: string | null; address: string | null }>(`/api/members/${encodeURIComponent(enrolleeId)}`)
  } catch {
    return { phone: null, address: null }
  }
}
