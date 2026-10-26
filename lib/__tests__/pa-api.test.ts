import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError, getStaffIdentity, logout } from '../api'
import * as pa from '../pa-api'
const uuid = '12345678-1234-1234-1234-123456789012'
const action = { requestId: uuid, expectedHeadVersion: 3, expectedActiveVersion: null, reason: 'Reviewed' }
const bytes = new TextEncoder().encode('\uFEFFschema_version,protected,proposed_medicloud_code\r\n1,"quoted,cell",DRG1\r\n')
function success(body: unknown = {}) { vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })) }
function called() { const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!; return { url: String(url), init: init!, headers: new Headers(init?.headers) } }
beforeEach(() => { vi.mocked(fetch).mockReset(); success() })

describe('all 21 reviewed PA routes', () => {
  const cases: [string, string, () => unknown][] = [
    ['POST', '/api/pa-preparation/batches', () => pa.createPreparationBatch('2026-10-16')],
    ['GET', '/api/pa-preparation/batches', () => pa.listPreparationBatches()],
    ['GET', `/api/pa-preparation/batches/${uuid}`, () => pa.getPreparationBatch(uuid)],
    ['GET', `/api/pa-preparation/batches/${uuid}/lines`, () => pa.listPreparationLines(uuid)],
    ['POST', `/api/pa-preparation/batches/${uuid}/orders/order-1/prepare`, () => pa.prepareOrder(uuid, 'order-1', { expectedVersion: 3 })],
    ['POST', `/api/pa-preparation/batches/${uuid}/orders/order-1/recalculate`, () => pa.recalculatePreparation(uuid, 'order-1', { expectedVersion: 3 })],
    ['POST', `/api/pa-preparation/batches/${uuid}/close`, () => pa.closePreparationBatch(uuid, { expectedVersion: 3 })],
    ['POST', `/api/pa-mapping-review/batches/${uuid}/exports`, () => pa.createMappingExport(uuid, { expectedVersion: 3 })],
    ['GET', `/api/pa-mapping-review/exports/${uuid}/download`, () => { vi.mocked(fetch).mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'text/csv' } })); return pa.downloadMappingCsv(uuid) }],
    ['POST', `/api/pa-mapping-review/exports/${uuid}/imports`, () => pa.importMappingProposals(uuid, bytes)],
    ['GET', `/api/pa-mapping-review/exports/${uuid}/import-status`, () => pa.getMappingImportStatus(uuid)],
    ['GET', '/api/pa-mapping-proposals', () => pa.listMappingProposals()],
    ['GET', `/api/pa-mapping-proposals/${uuid}`, () => pa.getMappingProposal(uuid)],
    ['POST', `/api/pa-mapping-proposals/${uuid}/reject`, () => pa.rejectMappingProposal(uuid, action)],
    ['POST', `/api/pa-mapping-proposals/${uuid}/approve`, () => pa.approveMappingProposal(uuid, action)],
    ['POST', `/api/pa-mapping-proposals/${uuid}/activate`, () => pa.activateMappingProposal(uuid, action)],
    ['GET', '/api/pa-catalog/snapshots', () => pa.listCatalogSnapshots()],
    ['GET', `/api/pa-catalog/snapshots/${uuid}`, () => pa.getCatalogSnapshot(uuid)],
    ['POST', '/api/pa-catalog/snapshots', () => pa.ingestSignedCatalog(new TextEncoder().encode('{"signed":"fixture"}'))],
    ['POST', `/api/pa-catalog/snapshots/${uuid}/validate`, () => pa.validateCatalogSnapshot(uuid)],
    ['POST', `/api/pa-catalog/snapshots/${uuid}/trust`, () => pa.trustCatalogSnapshot(uuid)],
  ]
  it.each(cases)('%s %s', async (method, path, invoke) => {
    await invoke()
    expect(called().url).toMatch(new RegExp(path + '$'))
    expect(called().init.method ?? 'GET').toBe(method)
    expect(called().init.credentials).toBe('include')
    expect(called().init.cache).toBe('no-store')
    expect(called().headers.has('origin')).toBe(false)
    if (method === 'POST') expect(called().headers.get('x-pharmacy-csrf')).toBe('1')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(called().url).not.toMatch(/generate-pa|IssuePa|pa-lines|pa-interruption/)
  })
})

it('serializes only actual server action fields, not actor/permissions/catalog/pricing extras', async () => {
  await pa.activateMappingProposal(uuid, { ...action, replaceActive: true, actorId: 'fake', price: 1, snapshotId: 'fake', permissions: ['all'] } as typeof action & { replaceActive: boolean })
  expect(JSON.parse(called().init.body as string)).toEqual({ ...action, replaceActive: true })
  await pa.validateCatalogSnapshot(uuid)
  expect(called().init.body).toBe('{}')
  await pa.trustCatalogSnapshot(uuid)
  expect(called().init.body).toBe('{}')
})

it('encodes safe filters including false and preserves cursor versus after parameter names', async () => {
  await pa.listPreparationLines(uuid, { stale: false, providerId: 'A&B', status: 'READY', mappingStatus: 'ACTIVE', cursor: uuid, limit: 2 })
  const url = new URL(called().url)
  expect(url.searchParams.get('stale')).toBe('false'); expect(url.searchParams.get('providerId')).toBe('A&B')
  expect(url.searchParams.get('cursor')).toBe(uuid); expect(url.searchParams.has('after')).toBe(false)
  await pa.listMappingProposals({ after: uuid }); expect(new URL(called().url).searchParams.get('after')).toBe(uuid)
})

it.each([{ 'X-Test': '1' }, new Headers({ 'X-Test': '1' }), [['X-Test', '1']] as [string, string][]])('merges every HeadersInit shape with JSON and forces credentials include', async headers => {
  await apiFetch('/api/test', { headers, credentials: 'omit' })
  expect(called().headers.get('content-type')).toBe('application/json')
  expect(called().headers.get('x-test')).toBe('1'); expect(called().init.credentials).toBe('include')
})

it('uploads UTF-8/BOM/quotes/CRLF bytes unchanged, including a subarray view', async () => {
  const padded = new Uint8Array(bytes.length + 4); padded.set(bytes, 2)
  await pa.importMappingProposals(uuid, padded.subarray(2, bytes.length + 2))
  expect(Array.from(new Uint8Array(called().init.body as ArrayBuffer))).toEqual(Array.from(bytes))
  expect(called().headers.get('content-type')).toBe('text/csv; charset=utf-8')
  expect(pa.CURSOR_EDITABLE_COLUMNS).toEqual(['proposed_medicloud_code', 'proposed_medicloud_description', 'mapping_notes'])
})

it.each([new Uint8Array(), new Uint8Array(pa.MAX_CSV_BYTES + 1), new Uint8Array([255])])('rejects invalid CSV bytes before network', bad => {
  expect(() => pa.importMappingProposals(uuid, bad)).toThrow()
  expect(fetch).not.toHaveBeenCalled()
})

it('reads signed catalog JSON bytes unchanged and rejects oversize artifacts before network', async () => {
  const catalog = new TextEncoder().encode('{"signed":"fixture"}')
  const file = { size: catalog.length, arrayBuffer: async () => catalog.buffer } as Blob
  expect(Array.from(await pa.readSignedCatalog(file))).toEqual(Array.from(catalog))
  expect(() => pa.ingestSignedCatalog(new Uint8Array(pa.MAX_CATALOG_BYTES + 1))).toThrow()
  expect(fetch).not.toHaveBeenCalled()
})

it('accepts the exact 512 KiB boundary and reads files without changing bytes', async () => {
  await pa.importMappingProposals(uuid, new Uint8Array(pa.MAX_CSV_BYTES).fill(65))
  expect((called().init.body as ArrayBuffer).byteLength).toBe(pa.MAX_CSV_BYTES)
  const file = { size: bytes.length, arrayBuffer: async () => bytes.buffer } as Blob
  expect(Array.from(await pa.readMappingCsv(file))).toEqual(Array.from(bytes))
  await expect(pa.readMappingCsv({ size: pa.MAX_CSV_BYTES + 1 } as Blob)).rejects.toThrow()
})

it('downloads authenticated raw CSV without JSON parsing or reconstructing protected columns', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } }))
  const blob = await pa.downloadMappingCsv(uuid)
  expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(Array.from(bytes))
})

it('rejects non-CSV downloads', async () => { await expect(pa.downloadMappingCsv(uuid)).rejects.toThrow('Expected CSV') })

it('retains only allowlisted structured errors and authorized owning-batch IDs', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: { code: 'ORDER_ALREADY_IN_ACTIVE_BATCH', owningBatchId: uuid, raw: 'secret' } }), { status: 409 }))
  await expect(pa.prepareOrder(uuid, 'order', { expectedVersion: 1 })).rejects.toMatchObject({ status: 409, code: 'ORDER_ALREADY_IN_ACTIVE_BATCH', owningBatchId: uuid })
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: { code: 'UNKNOWN_SECRET', owningBatchId: 'private', raw: 'secret' } }), { status: 409 }))
  try { await pa.getPreparationBatch(uuid) } catch (error) {
    expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).code).toBeUndefined()
    expect((error as ApiError).owningBatchId).toBeUndefined(); expect(JSON.stringify(error)).not.toContain('secret')
  }
})

it('handles 403 without clearing session or redirecting, and never retries a mutation', async () => {
  document.cookie = 'staff_session=opaque; path=/'
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: 'Forbidden' }), { status: 403 }))
  await expect(pa.approveMappingProposal(uuid, action)).rejects.toMatchObject({ status: 403 })
  expect(document.cookie).toContain('staff_session=opaque'); expect(fetch).toHaveBeenCalledTimes(1)
  document.cookie = 'staff_session=; path=/; max-age=0'
})

it('handles raw-download 401 using the same staff login redirection as JSON', async () => {
  const assign = vi.fn(); const previous = window
  vi.stubGlobal('window', { location: { pathname: '/staff/pa-preparation', assign } })
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }))
  try { await expect(pa.downloadMappingCsv(uuid)).rejects.toMatchObject({ status: 401 }); expect(assign).toHaveBeenCalledWith('/staff/login') }
  finally { vi.stubGlobal('window', previous) }
})

it('parses only backend PA permissions, preserves legacy fields and defaults absent permissions to empty', async () => {
  const identity = { userId: 'staff', name: 'Staff', email: 'staff@example.test' }
  success({ ...identity, permissions: ['PA_CATALOG_READ', 'forged', 'PA_CATALOG_READ', {}, 1] })
  expect(await getStaffIdentity()).toEqual({ ...identity, permissions: ['PA_CATALOG_READ'] })
  success(identity); expect(await getStaffIdentity()).toEqual({ ...identity, permissions: [] })
})

it('keeps logout transport and cookie cleanup compatible', async () => {
  document.cookie = 'staff_session=opaque; path=/'
  await logout()
  expect(called().url).toMatch(/\/api\/auth\/logout$/); expect(called().init.method).toBe('POST')
  expect(document.cookie).not.toContain('staff_session=opaque')
})


it('does not expose nested server internals or invalid ownership IDs in structured errors', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: { code: 'ORDER_ALREADY_IN_ACTIVE_BATCH', owningBatchId: 'private-invalid-id', raw: 'secret' } }), { status: 409 }))
  await expect(pa.getPreparationBatch(uuid)).rejects.toMatchObject({ code: 'ORDER_ALREADY_IN_ACTIVE_BATCH', owningBatchId: undefined })
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: 'secret', internal: 'secret' }), { status: 503 }))
  await expect(pa.activateMappingProposal(uuid, action)).rejects.toMatchObject({ status: 503, message: 'Service unavailable. Please try again.', code: undefined })
})

it('preserves requestId and exact action body on an explicit repeat; never adds retry rights', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: 'MAPPING_HEAD_CHANGED' }), { status: 409 }))
  await expect(pa.approveMappingProposal(uuid, action)).rejects.toMatchObject({ code: 'MAPPING_HEAD_CHANGED' })
  expect(fetch).toHaveBeenCalledTimes(1)
  const first = called().init.body
  success()
  await pa.approveMappingProposal(uuid, action)
  expect(called().init.body).toBe(first)
  expect(fetch).toHaveBeenCalledTimes(2)
})


it('retains the backend-supported INVALID catalog mutation status without promoting trust', async () => {
  const status: import('../pa-types').CatalogMutationResult['status'] = 'INVALID'
  const result: import('../pa-types').CatalogMutationResult = {
    snapshotId: uuid, source: 'MEDICLOUD_PROCEDUREDATA', sourceExtractedAt: '2026-10-16T00:00:00Z',
    importedAt: '2026-10-16T01:00:00Z', recordCount: 1, status, schemaVersion: 1,
    providerTariffEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED',
  }
  success(result)
  await expect(pa.ingestSignedCatalog(new TextEncoder().encode('{"signed":"fixture"}'))).resolves.toEqual(result)
  expect(fetch).toHaveBeenCalledTimes(1)
})
