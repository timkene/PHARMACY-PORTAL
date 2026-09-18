import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('prefixes NEXT_PUBLIC_API_URL', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://test.local'
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })
    const { apiFetch } = await import('../api')
    await apiFetch('/api/test')
    expect(fetch).toHaveBeenCalledWith('http://test.local/api/test', expect.any(Object))
  })

  it('throws ApiError on non-ok response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://test.local'
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    })
    const { apiFetch, ApiError } = await import('../api')
    await expect(apiFetch('/api/test')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('direct assignment API contract', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))
  })

  it('sends exact direct quote JSON and credentials', async () => {
    const { submitDirectQuote } = await import('../api')
    await submitDirectQuote('test-1', { totalPrice: 1500, expectedVersion: 7 })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/orders/test-1/direct-quote'), expect.objectContaining({
      method: 'POST', credentials: 'include', body: JSON.stringify({ totalPrice: 1500, expectedVersion: 7 }),
    }))
  })

  it('preserves bodyless competitive acceptance and optional versioned direct acceptance', async () => {
    const { acceptOrder } = await import('../api')
    await acceptOrder('test-1')
    expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty('body')
    await acceptOrder('test-1', { expectedVersion: 8 })
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe('{"expectedVersion":8}')
  })

  it('sends current version with fulfilment only when supplied', async () => {
    const { fulfillOrder } = await import('../api')
    await fulfillOrder('test-1', 'delivered', 0, { expectedVersion: 9 })
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toEqual({ fulfillmentType: 'delivered', deliveryFee: 0, expectedVersion: 9 })
    await fulfillOrder('test-1', 'picked_up')
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({ fulfillmentType: 'picked_up' })
  })

  it('exposes a typed conflict and never retries a mutation', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: 'Order changed' }) } as Response)
    const { submitDirectQuote, ApiError } = await import('../api')
    const promise = submitDirectQuote('test-1', { totalPrice: 1, expectedVersion: 2 })
    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ status: 409, message: 'Order changed' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns expired/wrong-role aggregator sessions to login and clears only aggregator cookie', async () => {
    const assign = vi.fn()
    const originalWindow = window
    vi.stubGlobal('window', { location: { pathname: '/aggregator/orders/test-1', assign } })
    document.cookie = 'aggregator_session=opaque-expired; path=/'
    document.cookie = 'staff_session=opaque-staff; path=/'
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) } as Response)
    try {
      const { getOrder } = await import('../api')
      await expect(getOrder('test-1')).rejects.toMatchObject({ status: 401 })
      expect(assign).toHaveBeenCalledExactlyOnceWith('/aggregator/login')
      expect(document.cookie).not.toContain('aggregator_session=')
      expect(document.cookie).toContain('staff_session=opaque-staff')
    } finally {
      vi.stubGlobal('window', originalWindow)
      document.cookie = 'staff_session=; path=/; max-age=0'
    }
  })

  it('keeps the aggregator login token opaque and uses the existing cookie mechanism', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ user: { companyName: 'Synthetic Pharmacy' }, session: 'opaque.signed.token' }) } as Response)
    const { aggregatorLogin } = await import('../api')
    const result = await aggregatorLogin('synthetic@example.test', 'synthetic')
    expect(result.user.companyName).toBe('Synthetic Pharmacy')
    expect(document.cookie).toContain('aggregator_session=opaque.signed.token')
    document.cookie = 'aggregator_session=; path=/; max-age=0'
  })

  it('does not expose server internals', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, json: async () => ({ detail: 'Secret stack trace' }) } as Response)
    const { getOrder } = await import('../api')
    await expect(getOrder('test-1')).rejects.toMatchObject({ message: 'Service unavailable. Please try again.' })
  })
})
