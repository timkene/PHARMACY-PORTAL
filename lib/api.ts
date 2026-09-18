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
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
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
    const error = data as { message?: unknown; detail?: unknown }
    const message = typeof error.message === 'string' ? error.message
      : typeof error.detail === 'string' ? error.detail : 'Please check your request and try again.'
    throw new ApiError(res.status, res.status >= 500 ? 'Service unavailable. Please try again.' : message)
  }
  return data as T
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
  return { userId: data.userId, name: data.name, email: data.email }
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

export const getOrders = () =>
  apiFetch<{ orders: Order[] }>('/api/orders')

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
