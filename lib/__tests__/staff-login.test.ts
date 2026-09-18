import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffLogin } from '../api'

afterEach(() => {
  document.cookie = 'staff_session=; path=/; max-age=0'
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// Login transport coverage; server identity validation is covered in auth.test.tsx.
describe('staff login credential transport', () => {
  it('retains the exact opaque backend credential without decoding, constructing, or needing a signing secret', async () => {
    vi.stubEnv('SESSION_SECRET', undefined)
    const session = 'opaque-staff.signature-not-json'
    const user = { id: 'staff-1', name: 'Test Staff', email: 'staff@example.test' }
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ user, session }) } as Response)
    const decode = vi.spyOn(globalThis, 'atob').mockImplementation(() => { throw new Error('Must not decode') })
    const parse = vi.spyOn(JSON, 'parse')

    await expect(staffLogin(user.email, 'test-password')).resolves.toEqual({ user, session })

    expect(document.cookie).toContain(`staff_session=${session}`)
    expect(decode).not.toHaveBeenCalled()
    expect(parse.mock.calls.some(([value]) => value === session)).toBe(false)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('/api/auth/staff/login'), expect.objectContaining({
      method: 'POST', credentials: 'include', body: JSON.stringify({ email: user.email, password: 'test-password' }),
    }))
  })

  it('does not create a credential when the backend rejects login', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) } as Response)
    await expect(staffLogin('staff@example.test', 'incorrect')).rejects.toMatchObject({ status: 401 })
    expect(document.cookie).not.toContain('staff_session=')
  })
})
