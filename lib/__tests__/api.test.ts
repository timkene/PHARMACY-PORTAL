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
