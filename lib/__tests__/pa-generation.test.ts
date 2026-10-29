import { beforeEach, expect, it, vi } from 'vitest'
import * as gen from '../pa-generation'

const orderId = '507f1f77bcf86cd799439011'
const lineId = 'line-1'
function success(body: unknown = {}) { vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })) }
function called() { const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!; return { url: String(url), init: init!, headers: new Headers(init?.headers) } }
beforeEach(() => { vi.mocked(fetch).mockReset(); success() })

it('posts generate-pa with expectedVersion and CSRF only', async () => {
  await gen.generatePharmacyPa(orderId, 4)
  expect(called().url).toMatch(new RegExp(`/api/orders/${orderId}/generate-pa$`))
  expect(called().init.method).toBe('POST')
  expect(called().headers.get('x-pharmacy-csrf')).toBe('1')
  expect(JSON.parse(called().init.body as string)).toEqual({ expectedVersion: 4 })
  expect(called().headers.has('origin')).toBe(false)
})

it('posts interruption recovery without extra authority fields', async () => {
  await gen.markPaVerificationRequired(orderId)
  expect(called().url).toMatch(/\/pa-interruption\/mark-verification-required$/)
  expect(JSON.parse(called().init.body as string)).toEqual({})
})

it('serializes only the matching verification contract fields', async () => {
  await gen.verifyPaLine(orderId, lineId, {
    resolution: 'existing_pa', evidence: 'Checked MediCloud reference ABC', paNumber: 'PA-1',
    confirmNoPaCreated: true, actor: 'nope',
  } as never)
  expect(JSON.parse(called().init.body as string)).toEqual({
    resolution: 'existing_pa', evidence: 'Checked MediCloud reference ABC', paNumber: 'PA-1',
  })
  await gen.verifyPaLine(orderId, lineId, {
    resolution: 'confirmed_no_pa', evidence: 'Authoritative absence documented',
    confirmNoPaCreated: true, confirmAuthoritativeAbsence: true,
    reconciliationReference: 'ticket-9', verificationMethod: 'portal',
    checkedWith: 'MediCloud ops', verifiedAt: '2026-10-20T10:00:00Z', paNumber: 'must-omit',
  })
  expect(JSON.parse(called().init.body as string)).toEqual({
    resolution: 'confirmed_no_pa', evidence: 'Authoritative absence documented',
    verificationMethod: 'portal', checkedWith: 'MediCloud ops', verifiedAt: '2026-10-20T10:00:00Z',
    confirmNoPaCreated: true, confirmAuthoritativeAbsence: true, reconciliationReference: 'ticket-9',
  })
  await gen.verifyPaLine(orderId, lineId, {
    resolution: 'confirmed_rejected', evidence: 'Authoritative delivery rejection',
    verificationMethod: 'register', checkedWith: 'MediCloud', verifiedAt: '2026-10-20T10:00:00Z',
    paNumber: 'must-omit', confirmNoPaCreated: true,
  })
  expect(JSON.parse(called().init.body as string)).toEqual({
    resolution: 'confirmed_rejected', evidence: 'Authoritative delivery rejection',
    verificationMethod: 'register', checkedWith: 'MediCloud', verifiedAt: '2026-10-20T10:00:00Z',
  })
})
