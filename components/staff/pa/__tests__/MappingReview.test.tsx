import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as api from '@/lib/pa-api'
import { ApiError } from '@/lib/api'
import { getStaffSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { PaPermission } from '@/lib/pa-permissions'
import type { ImportReceipt, PreparationBatch, ReviewExport } from '@/lib/pa-types'
import { MappingReviewWorkspace } from '../MappingReviewWorkspace'
import MappingReviewPage from '@/app/staff/pa-mapping-review/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), usePathname: () => '/staff/pa-mapping-review', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ getStaffSession: vi.fn() }))
vi.mock('@/lib/pa-api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pa-api')>()
  return { ...actual, createMappingExport: vi.fn(), downloadMappingCsv: vi.fn(), importMappingProposals: vi.fn(),
    getMappingImportStatus: vi.fn(), listPreparationBatches: vi.fn() }
})

const batchId = '11111111-1111-4111-8111-111111111111'
const exportId = '22222222-2222-4222-8222-222222222222'
const cursor = '33333333-3333-4333-8333-333333333333'
const future = new Date(Date.now() + 3600_000).toISOString()
const past = new Date(Date.now() - 3600_000).toISOString()
const batch = (overrides: Partial<PreparationBatch> = {}): PreparationBatch => ({ batchId, businessDate: '2026-10-20', status: 'OPEN', version: 7, createdAt: '2026-10-20T08:00:00Z',
  counts: { orders: 1, lines: 1, ready: 0, reviewRequired: 1, blocked: 0, submitted: null, verificationRequired: null, stale: null }, countsScope: 'LAST_CALCULATION', countsAsOf: null, ...overrides })
const created = (overrides: Partial<ReviewExport> = {}): ReviewExport => ({ exportId, batchId, status: 'OPEN', createdAt: '2026-10-20T09:00:00.000Z', expiresAt: future,
  contentDigest: 'a'.repeat(64), rowCount: 2, nextCursor: null, skippedRows: 3, skipReasons: { NOT_ACTIONABLE_MAPPING_REVIEW: 2, PREPARATION_STALE: 1 }, ...overrides } as ReviewExport)
const receipt: ImportReceipt = { importId: '44444444-4444-4444-8444-444444444444', exportId, status: 'PROPOSED_ONLY', importedAt: '2026-10-20T10:00:00.000Z', proposedRows: 1, unresolvedRows: 1, proposalCount: 1 }
// BOM, CRLF and a quoted cell: bytes must reach the API unchanged.
const csvBytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('a,"b, c"\r\n1,2\r\n')])

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listPreparationBatches).mockResolvedValue({ items: [batch(), batch({ batchId: cursor, status: 'CLOSED' })], nextCursor: null })
  vi.mocked(api.createMappingExport).mockResolvedValue(created())
  vi.mocked(api.downloadMappingCsv).mockResolvedValue(new Blob(['csv'], { type: 'text/csv' }))
  vi.mocked(api.importMappingProposals).mockResolvedValue(receipt)
  vi.mocked(api.getMappingImportStatus).mockResolvedValue({ exportId, status: 'NOT_IMPORTED' })
})

const workspace = (permissions: PaPermission[]) => render(<MappingReviewWorkspace userName="Staff" permissions={permissions} />)
function fillExport(values: { batch?: string; version?: string; after?: string; limit?: string } = {}) {
  fireEvent.change(screen.getByLabelText('Batch ID'), { target: { value: values.batch ?? batchId } })
  fireEvent.change(screen.getByLabelText('Expected batch version'), { target: { value: values.version ?? '7' } })
  if (values.after !== undefined) fireEvent.change(screen.getByLabelText('Continue after cursor (optional)'), { target: { value: values.after } })
  if (values.limit !== undefined) fireEvent.change(screen.getByLabelText(/Row limit/), { target: { value: values.limit } })
}
async function chooseFile(bytes: Uint8Array = csvBytes, name = 'review.csv') {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength)); copy.set(bytes)
  fireEvent.change(screen.getByLabelText('Export ID'), { target: { value: exportId } })
  fireEvent.change(screen.getByLabelText('Edited CSV file'), { target: { files: [new File([copy], name, { type: 'text/csv' })] } })
}

describe('page and permissions', () => {
  it('redirects unauthenticated staff', async () => {
    vi.mocked(getStaffSession).mockResolvedValue(null)
    await expect(MappingReviewPage()).rejects.toThrow('REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/staff/login')
  })
  it('renders the workspace with server-validated permissions', async () => {
    vi.mocked(getStaffSession).mockResolvedValue({ userId: 'u', name: 'Staff', email: '', permissions: ['PA_MAPPING_IMPORT'] })
    render(await MappingReviewPage())
    expect(screen.getByRole('region', { name: 'Import edited mapping review' })).toBeInTheDocument()
  })
  it('shows nothing actionable and makes no request without EXPORT or IMPORT', () => {
    workspace(['PA_PREPARATION_READ', 'PA_MAPPING_REVIEW'])
    expect(screen.getByRole('alert')).toHaveTextContent('PA_MAPPING_EXPORT or PA_MAPPING_IMPORT')
    expect(screen.queryByRole('region', { name: 'Create mapping review export' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Import edited mapping review' })).not.toBeInTheDocument()
    expect(api.listPreparationBatches).not.toHaveBeenCalled()
  })
  it('EXPORT-only gets the export panel with manual entry and no batch listing', () => {
    workspace(['PA_MAPPING_EXPORT'])
    expect(screen.getByRole('region', { name: 'Create mapping review export' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Import edited mapping review' })).not.toBeInTheDocument()
    expect(screen.getByText(/Enter the batch ID and its current version/)).toBeInTheDocument()
    expect(api.listPreparationBatches).not.toHaveBeenCalled()
  })
  it('IMPORT-only gets the import panel only', () => {
    workspace(['PA_MAPPING_IMPORT'])
    expect(screen.getByRole('region', { name: 'Import edited mapping review' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Create mapping review export' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create export' })).not.toBeInTheDocument()
  })
  it('names exactly the three editable columns', () => {
    workspace(['PA_MAPPING_IMPORT'])
    const items = within(screen.getByRole('region', { name: 'Editable columns' })).getAllByRole('listitem').map(item => item.textContent)
    expect(items).toEqual(['proposed_medicloud_code', 'proposed_medicloud_description', 'mapping_notes'])
  })
})

describe('export', () => {
  it('with preparation READ, offers only open batches and uses the listed version', async () => {
    workspace(['PA_MAPPING_EXPORT', 'PA_PREPARATION_READ'])
    fireEvent.click(await screen.findByRole('button', { name: `Use batch ${batchId}` }))
    expect(screen.queryByRole('button', { name: `Use batch ${cursor}` })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    await waitFor(() => expect(api.createMappingExport).toHaveBeenCalledWith(batchId, { expectedVersion: 7, limit: 50 }))
  })
  it('sends cursor and limit, and shows counts, skip reasons, expiry and export ID', async () => {
    workspace(['PA_MAPPING_EXPORT'])
    fillExport({ after: cursor, limit: '20' })
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    await waitFor(() => expect(api.createMappingExport).toHaveBeenCalledWith(batchId, { expectedVersion: 7, after: cursor, limit: 20 }))
    const result = await screen.findByRole('region', { name: 'Export result' })
    expect(result).toHaveTextContent('Rows exported: 2')
    expect(result).toHaveTextContent('Rows skipped: 3')
    expect(within(result).getByText('PREPARATION_STALE')).toBeInTheDocument()
    expect(within(result).getByText('NOT_ACTIONABLE_MAPPING_REVIEW')).toBeInTheDocument()
    expect(result).toHaveTextContent(exportId)
    expect(result).toHaveTextContent(`Expires: ${future}`)
  })
  it('rejects invalid input locally without a request', () => {
    workspace(['PA_MAPPING_EXPORT'])
    const button = screen.getByRole('button', { name: 'Create export' })
    fillExport({ batch: 'not-a-uuid' }); expect(button).toBeDisabled()
    fillExport({ limit: '101' }); expect(button).toBeDisabled()
    fillExport({ limit: '0' }); expect(button).toBeDisabled()
    fillExport({ version: '-1', limit: '50' }); expect(button).toBeDisabled()
    fillExport({ after: 'bad-cursor' }); expect(button).toBeDisabled()
    expect(api.createMappingExport).not.toHaveBeenCalled()
  })
  it('an empty scan offers its continuation cursor without auto-submitting', async () => {
    vi.mocked(api.createMappingExport).mockResolvedValueOnce({ exportId: null, batchId, status: 'EMPTY_SCAN', rowCount: 0, nextCursor: cursor, skippedRows: 200, skipReasons: { NOT_ACTIONABLE_MAPPING_REVIEW: 200 } })
    workspace(['PA_MAPPING_EXPORT']); fillExport()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    expect(await screen.findByText(/Continue from the next cursor/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue from next cursor' }))
    expect(screen.getByLabelText('Continue after cursor (optional)')).toHaveValue(cursor)
    expect(api.createMappingExport).toHaveBeenCalledTimes(1)
  })
  it('downloads through the authenticated client and saves a CSV file', async () => {
    const createObjectURL = vi.fn(() => 'blob:review'); const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    workspace(['PA_MAPPING_EXPORT']); fillExport()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Download CSV' }))
    await waitFor(() => expect(api.downloadMappingCsv).toHaveBeenCalledWith(exportId))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })
  it('shows an expired-export download error', async () => {
    vi.mocked(api.downloadMappingCsv).mockRejectedValueOnce(new ApiError(409, 'internal', 'EXPORT_EXPIRED'))
    workspace(['PA_MAPPING_EXPORT']); fillExport()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Download CSV' }))
    expect(await screen.findByText(/This export has expired/)).toBeInTheDocument()
    expect(screen.queryByText('internal')).not.toBeInTheDocument()
  })
  it('flags an export whose expiry has passed on this device', async () => {
    vi.mocked(api.createMappingExport).mockResolvedValueOnce(created({ expiresAt: past }))
    workspace(['PA_MAPPING_EXPORT']); fillExport()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    expect(await screen.findByText(/expired by this device/)).toBeInTheDocument()
  })
  it('a definite 4xx rejection shows its reason and allows an explicit retry', async () => {
    vi.mocked(api.createMappingExport).mockRejectedValueOnce(new ApiError(409, 'internal', 'BATCH_VERSION_CONFLICT'))
    workspace(['PA_MAPPING_EXPORT']); fillExport()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    expect(await screen.findByText(/The batch changed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create export' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    await waitFor(() => expect(api.createMappingExport).toHaveBeenCalledTimes(2))
  })
  it.each([new ApiError(503, 'internal'), new TypeError('Failed to fetch'), new ApiError(409, 'internal', 'TRANSACTION_CONFLICT_REFRESH_REQUIRED')])(
    'an uncertain export outcome locks creation until explicitly acknowledged (%s)', async error => {
      vi.mocked(api.createMappingExport).mockRejectedValueOnce(error)
      workspace(['PA_MAPPING_EXPORT']); fillExport()
      fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
      expect(await screen.findByText(/export outcome is unknown/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create export' })).toBeDisabled()
      expect(api.createMappingExport).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Allow a new export' }))
      expect(screen.getByRole('button', { name: 'Create export' })).toBeEnabled()
      expect(api.createMappingExport).toHaveBeenCalledTimes(1)
    })
  it('a rapid double submit creates a single export', async () => {
    let resolve: (value: ReviewExport) => void = () => {}
    vi.mocked(api.createMappingExport).mockReturnValueOnce(new Promise(done => { resolve = done }))
    workspace(['PA_MAPPING_EXPORT']); fillExport()
    const button = screen.getByRole('button', { name: 'Create export' })
    fireEvent.click(button); fireEvent.click(button)
    resolve(created())
    await screen.findByRole('region', { name: 'Export result' })
    expect(api.createMappingExport).toHaveBeenCalledTimes(1)
  })
})

describe('import', () => {
  it('uploads the selected file bytes unchanged and shows a PROPOSED-only receipt', async () => {
    workspace(['PA_MAPPING_IMPORT']); await chooseFile()
    await screen.findByText(/uploaded unchanged/)
    fireEvent.click(screen.getByRole('button', { name: 'Upload edited CSV' }))
    await waitFor(() => expect(api.importMappingProposals).toHaveBeenCalledTimes(1))
    const [id, sent] = vi.mocked(api.importMappingProposals).mock.calls[0]
    expect(id).toBe(exportId)
    expect(Array.from(sent)).toEqual(Array.from(csvBytes))
    const shown = await screen.findByRole('region', { name: 'Import receipt' })
    expect(shown).toHaveTextContent('PROPOSED only, not approved or active')
    expect(shown).toHaveTextContent('Proposals created: 1')
  })
  it.each([
    ['invalid UTF-8', new Uint8Array([0x61, 0xff, 0xfe])],
    ['empty', new Uint8Array([])],
    ['over 512 KiB', new Uint8Array(512 * 1024 + 1).fill(0x61)],
  ])('rejects an %s file locally without uploading', async (_label, bytes) => {
    workspace(['PA_MAPPING_IMPORT']); await chooseFile(bytes)
    expect(await screen.findByText(/must be non-empty, at most 512 KiB and valid UTF-8/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload edited CSV' })).toBeDisabled()
    expect(api.importMappingProposals).not.toHaveBeenCalled()
  })
  it.each([
    ['PROTECTED_CELLS_CHANGED', 400, /Protected columns were changed/],
    ['EXPORT_EXPIRED', 409, /This export has expired/],
    ['EXPORT_ALREADY_IMPORTED_DIFFERENT_CONTENT', 409, /already imported with different content/],
  ] as const)('a definite %s rejection is explained and does not lock upload', async (code, status, message) => {
    vi.mocked(api.importMappingProposals).mockRejectedValueOnce(new ApiError(status, 'internal', code))
    workspace(['PA_MAPPING_IMPORT']); await chooseFile(); await screen.findByText(/uploaded unchanged/)
    fireEvent.click(screen.getByRole('button', { name: 'Upload edited CSV' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(/import outcome is unknown/)).not.toBeInTheDocument()
    expect(screen.queryByText('internal')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload edited CSV' })).toBeEnabled()
  })
  it.each([new ApiError(503, 'internal'), new TypeError('Failed to fetch'), new ApiError(409, 'internal', 'TRANSACTION_CONFLICT_REFRESH_REQUIRED')])(
    'an uncertain import locks upload until status shows NOT_IMPORTED (%s)', async error => {
      vi.mocked(api.importMappingProposals).mockRejectedValueOnce(error)
      workspace(['PA_MAPPING_IMPORT']); await chooseFile(); await screen.findByText(/uploaded unchanged/)
      fireEvent.click(screen.getByRole('button', { name: 'Upload edited CSV' }))
      expect(await screen.findByText(/import outcome is unknown/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Upload edited CSV' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Check import status' }))
      await waitFor(() => expect(api.getMappingImportStatus).toHaveBeenCalledWith(exportId))
      expect(await screen.findByText(/Not imported yet/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Upload edited CSV' })).toBeEnabled()
      expect(api.importMappingProposals).toHaveBeenCalledTimes(1)
    })
  it('a status check after an uncertain import shows the existing receipt', async () => {
    vi.mocked(api.importMappingProposals).mockRejectedValueOnce(new ApiError(502, 'internal'))
    vi.mocked(api.getMappingImportStatus).mockResolvedValueOnce(receipt)
    workspace(['PA_MAPPING_IMPORT']); await chooseFile(); await screen.findByText(/uploaded unchanged/)
    fireEvent.click(screen.getByRole('button', { name: 'Upload edited CSV' }))
    await screen.findByText(/import outcome is unknown/)
    fireEvent.click(screen.getByRole('button', { name: 'Check import status' }))
    expect(await screen.findByRole('region', { name: 'Import receipt' })).toHaveTextContent(receipt.importId)
  })
  it('a rapid double submit uploads once', async () => {
    let resolve: (value: ImportReceipt) => void = () => {}
    vi.mocked(api.importMappingProposals).mockReturnValueOnce(new Promise(done => { resolve = done }))
    workspace(['PA_MAPPING_IMPORT']); await chooseFile(); await screen.findByText(/uploaded unchanged/)
    const button = screen.getByRole('button', { name: 'Upload edited CSV' })
    fireEvent.click(button); fireEvent.click(button)
    resolve(receipt)
    await screen.findByRole('region', { name: 'Import receipt' })
    expect(api.importMappingProposals).toHaveBeenCalledTimes(1)
  })
  it('with both permissions, offers the just-created export and shows its expiry', async () => {
    vi.mocked(api.createMappingExport).mockResolvedValueOnce(created({ expiresAt: past }))
    workspace(['PA_MAPPING_EXPORT', 'PA_MAPPING_IMPORT']); fillExport()
    fireEvent.click(screen.getByRole('button', { name: 'Create export' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Use the export just created' }))
    expect(screen.getByLabelText('Export ID')).toHaveValue(exportId)
    const panel = screen.getByRole('region', { name: 'Import edited mapping review' })
    expect(panel).toHaveTextContent(`Export expires: ${past}`)
    expect(within(panel).getByText(/expired by this device/)).toBeInTheDocument()
  })
  it('never calls proposal, activation or catalog operations', async () => {
    workspace(['PA_MAPPING_EXPORT', 'PA_MAPPING_IMPORT']); await chooseFile(); await screen.findByText(/uploaded unchanged/)
    fireEvent.click(screen.getByRole('button', { name: 'Upload edited CSV' }))
    await screen.findByRole('region', { name: 'Import receipt' })
    expect(screen.queryByRole('button', { name: /approve|activate|trust/i })).not.toBeInTheDocument()
  })
})
