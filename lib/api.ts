import { parsePaPermissions } from './pa-permissions'
import { structuredPaError } from './pa-errors'
import type { PaErrorCode } from './pa-errors'
import type {
  DirectQuoteRequest,
  ExpectedVersion,
  LifecycleResponse,
  StaffUser,
  StaffIdentity,
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

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://pharmacy-dispatch-api.onrender.com'

function setDomainCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; SameSite=Lax`
}

function clearDomainCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: PaErrorCode, public owningBatchId?: string | null) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Shared JSON/raw transport, including auth failures. Never retries a request. */
export async function apiResponse(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  new Headers(init?.headers).forEach((value, key) => {
    for (const existing of Object.keys(headers)) {
      if (existing.toLowerCase() === key) delete headers[existing]
    }
    headers[key] = value
  })
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include', headers })
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}))
    if (res.status === 401 && typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/staff/') &&
        window.location.pathname !== '/staff/login' &&
        (!path.startsWith('/api/auth/') || path === '/api/auth/staff/me')) {
      clearDomainCookie('staff_session')
      window.location.assign('/staff/login')
    }
    if (res.status === 401 && typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/aggregator/') &&
        !path.startsWith('/api/auth/')) {
      clearDomainCookie('aggregator_session')
      window.location.assign('/aggregator/login')
    }
    const structured = structuredPaError(data)
    const error = (data && typeof data === 'object' ? data : {}) as { message?: unknown; detail?: unknown }
    const message = typeof error.message === 'string' ? error.message
      : typeof error.detail === 'string' ? error.detail : 'Please check your request and try again.'
    throw new ApiError(res.status, res.status >= 500 ? 'Service unavailable. Please try again.' : message,
      res.status < 500 ? structured?.code : undefined, res.status < 500 ? structured?.owningBatchId : undefined)
  }
  return res
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiResponse(path, init)
  return await res.json().catch(() => ({})) as T
}

// Auth
export const getStaffIdentity = async (headers?: HeadersInit): Promise<StaffIdentity> => {
  const data = await apiFetch<StaffIdentity>('/api/auth/staff/me', {
    credentials: 'include', cache: 'no-store', redirect: 'error',
    ...(headers ? { headers } : {}),
  })
  if (!data || typeof data.userId !== 'string' || typeof data.name !== 'string' || typeof data.email !== 'string') {
    throw new Error('Invalid staff identity response')
  }
  return { userId: data.userId, name: data.name, email: data.email, permissions: parsePaPermissions(data.permissions) }
}

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

export const getOrders = (page = 1, limit = 20) =>
  apiFetch<{ orders: Order[]; total: number; page: number }>(
    `/api/orders?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`,
  )

export async function getAllStaffOrders(): Promise<Order[]> {
  const pageSize = 100
  const first = await getOrders(1, pageSize)
  const orders = [...(first.orders ?? [])]
  const total = typeof first.total === 'number' ? first.total : orders.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  for (let page = 2; page <= pages; page += 1) {
    const next = await getOrders(page, pageSize)
    orders.push(...(next.orders ?? []))
  }
  return orders
}

export async function loadOrdersForPaExport(): Promise<Order[]> {
  const listed = await getAllStaffOrders()
  const detailed = await Promise.all(listed.map(async order => {
    if (order.provider?.providerId && order.provider?.providerName) return order
    try {
      const { order: detail } = await getOrder(order.id)
      return {
        ...order,
        ...detail,
        medications: (detail.medications?.length ? detail.medications : order.medications) ?? [],
        provider: detail.provider ?? order.provider,
      }
    } catch {
      return order
    }
  }))
  return detailed
}

export const deleteOrder = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/orders/${id}`, { method: 'DELETE' })

export const getOrder = async (id: string): Promise<{ order: Order; bids: Bid[]; status: OrderStatus }> => {
  const order = await apiFetch<Order>(`/api/orders/${id}`, { cache: 'no-store' })
  return { order, bids: order.bids ?? [], status: order.status }
}

// Aggregator actions
export const submitDirectQuote = (orderId: string, payload: DirectQuoteRequest) =>
  apiFetch<LifecycleResponse>(`/api/orders/${orderId}/direct-quote`, {
    method: 'POST', body: JSON.stringify(payload),
  })

export const acceptOrder = (orderId: string, concurrency?: ExpectedVersion) =>
  apiFetch<{ success: boolean }>(`/api/orders/${orderId}/accept`, {
    method: 'POST',
    ...(concurrency ? { body: JSON.stringify(concurrency) } : {}),
  })

export const fulfillOrder = (
  orderId: string,
  fulfillmentType: 'delivered' | 'picked_up',
  deliveryFee?: number,
  concurrency?: ExpectedVersion
) =>
  apiFetch<{ success: boolean }>(`/api/orders/${orderId}/fulfill`, {
    method: 'POST',
    body: JSON.stringify({ fulfillmentType, deliveryFee, ...concurrency }),
  })

export const getAggregatorDashboard = () =>
  apiFetch<AggregatorDashboard>('/api/aggregator/dashboard')

export const getAggregatorOrders = () =>
  apiFetch<AggregatorOrdersResponse>('/api/aggregator/orders')

export const placeBid = (orderId: string, procedurePrices: import('./procedure-pricing').ProcedurePrice[] | number) =>
  apiFetch<{ bid: Bid }>(`/api/orders/${orderId}/bids`, {
    method: 'POST',
    body: JSON.stringify(typeof procedurePrices === 'number' ? { totalPrice: procedurePrices } : { procedurePrices }),
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
