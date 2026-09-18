import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getStaffSession } from '../auth'
import { API_BASE, getStaffIdentity } from '../api'
import StaffDashboardPage from '@/app/staff/dashboard/page'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('LOGIN_REDIRECT') }) }))
vi.mock('@/app/staff/dashboard/client', () => ({ StaffDashboardClient: () => null }))

const identity = { userId: 'staff-1', name: 'Backend Staff Name', email: 'staff@example.test' }
const opaqueToken = 'opaque.staff.signature-not-json'
const cookieGet = vi.fn()
function response(status: number, data: unknown = identity) {
  vi.mocked(fetch).mockResolvedValue({ ok: status === 200, status, json: async () => data } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieGet.mockImplementation(name => ({ value: name === 'staff_session' ? opaqueToken : 'unrelated-secret' }))
  vi.mocked(cookies).mockResolvedValue({ get: cookieGet } as unknown as Awaited<ReturnType<typeof cookies>>)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  document.cookie = 'staff_session=; path=/; max-age=0'
  document.cookie = 'aggregator_session=; path=/; max-age=0'
})

describe('server staff identity', () => {
  it('forwards only the opaque staff cookie and returns backend identity without a signing secret', async () => {
    vi.stubEnv('SESSION_SECRET', undefined)
    response(200)
    const buffer = vi.spyOn(Buffer, 'from')
    const parse = vi.spyOn(JSON, 'parse')
    const decode = vi.spyOn(globalThis, 'atob')
    await expect(getStaffSession()).resolves.toEqual(identity)
    expect(cookieGet).toHaveBeenCalledExactlyOnceWith('staff_session')
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`${API_BASE}/api/auth/staff/me`, {
      credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Cookie: `staff_session=${opaqueToken}` },
    })
    expect(buffer.mock.calls.some(([value]) => value === opaqueToken)).toBe(false)
    expect(parse.mock.calls.some(([value]) => value === opaqueToken)).toBe(false)
    expect(decode).not.toHaveBeenCalled()
  })

  it('renders the staff dashboard with authoritative backend display identity', async () => {
    response(200)
    const page = await StaffDashboardPage()
    expect(page.props.userName).toBe(identity.name)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('serializes cookie delimiters so a malformed credential cannot inject other cookies', async () => {
    cookieGet.mockReturnValue({ value: 'invalid; aggregator_session=injected' })
    response(401)
    await expect(getStaffSession()).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/auth/staff/me`, expect.objectContaining({
      headers: { Cookie: 'staff_session=invalid%3B%20aggregator_session%3Dinjected' },
    }))
  })

  it('redirects missing credentials without contacting the backend', async () => {
    cookieGet.mockReturnValue(undefined)
    await expect(StaffDashboardPage()).rejects.toThrow('LOGIN_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/staff/login')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['malformed', 'tampered.signature', 'expired.signature', 'aggregator.signature'])('redirects backend-rejected %s credentials even in staff_session', async token => {
    cookieGet.mockReturnValue({ value: token })
    response(401)
    await expect(StaffDashboardPage()).rejects.toThrow('LOGIN_REDIRECT')
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/api/auth/staff/me`, expect.objectContaining({ headers: { Cookie: `staff_session=${token}` } }))
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/staff/login')
  })

  it('does not retain a previously authenticated identity after a 401', async () => {
    response(200)
    await expect(getStaffSession()).resolves.toEqual(identity)
    response(401)
    await expect(getStaffSession()).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([403, 500, 503])('propagates backend %s separately from a login rejection', async status => {
    response(status)
    await expect(StaffDashboardPage()).rejects.toMatchObject({ status })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('propagates network failure without granting access or redirecting to login', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network unavailable'))
    await expect(StaffDashboardPage()).rejects.toThrow('Network unavailable')
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([null, {}, { ...identity, userId: 1 }, { ...identity, name: null }, { ...identity, email: false }])('rejects malformed backend identity %j', async data => {
    response(200, data)
    await expect(StaffDashboardPage()).rejects.toThrow('Invalid staff identity response')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('contains no legacy session decoding, construction, signature verification, or signing secret in auth code', () => {
    for (const file of ['lib/auth.ts', 'lib/api.ts', 'app/staff/login/page.tsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/Buffer\.from|\batob\s*\(|\bbtoa\s*\(|JSON\.parse|SESSION_SECRET|createHmac|jsonwebtoken|jwtVerify|SignJWT/)
    }
  })
})

describe('browser staff identity', () => {
  it('uses browser cookies and requests uncached backend identity without duplicating credentials', async () => {
    response(200)
    await expect(getStaffIdentity()).resolves.toEqual(identity)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`${API_BASE}/api/auth/staff/me`, {
      credentials: 'include', cache: 'no-store', redirect: 'error', headers: { 'Content-Type': 'application/json' },
    })
  })

  it('clears a rejected staff cookie and navigates to login without touching the aggregator cookie', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/staff/dashboard', assign } })
    document.cookie = 'staff_session=invalid; path=/'
    document.cookie = 'aggregator_session=unchanged; path=/'
    response(401)
    await expect(getStaffIdentity()).rejects.toMatchObject({ status: 401 })
    expect(assign).toHaveBeenCalledExactlyOnceWith('/staff/login')
    expect(document.cookie).not.toContain('staff_session=')
    expect(document.cookie).toContain('aggregator_session=unchanged')
  })

  it('does not redirect from the login page on a 401', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/staff/login', assign } })
    response(401)
    await expect(getStaffIdentity()).rejects.toMatchObject({ status: 401 })
    expect(assign).not.toHaveBeenCalled()
  })

  it('does not clear credentials or redirect on an outage', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/staff/dashboard', assign } })
    document.cookie = 'staff_session=opaque; path=/'
    response(503)
    await expect(getStaffIdentity()).rejects.toMatchObject({ status: 503 })
    expect(assign).not.toHaveBeenCalled()
    expect(document.cookie).toContain('staff_session=opaque')
  })
})
