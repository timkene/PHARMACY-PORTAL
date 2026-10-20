import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as api from '@/lib/pa-api'
import { ApiError } from '@/lib/api'
import type { PreparationBatch, PreparationLine, LinePage, PreparationRow } from '@/lib/pa-types'
import { PreparationList } from '../PreparationList'
import { BatchWorkspace } from '../BatchWorkspace'
import { PreparationTable, PreparationError } from '../PreparationShared'
vi.mock('next/navigation', () => ({ usePathname: () => '/staff/pa-preparation', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/pa-api', () => ({ createPreparationBatch: vi.fn(), listPreparationBatches: vi.fn(), getPreparationBatch: vi.fn(), listPreparationLines: vi.fn(), prepareOrder: vi.fn(), recalculatePreparation: vi.fn(), closePreparationBatch: vi.fn() }))
const batchId = '11111111-1111-4111-8111-111111111111'
const orderId = '1234567890abcdef12345678'
const batch: PreparationBatch = { batchId, businessDate: '2026-10-16', status: 'OPEN', version: 3, createdAt: '2026-10-16T10:00:00Z', counts: { orders: 1, lines: 1, ready: 1, reviewRequired: 0, blocked: 0, submitted: null, verificationRequired: null, stale: null }, countsScope: 'LAST_CALCULATION', countsAsOf: null }
const line: PreparationLine = { batchId, preparationLineId: 'line-a', preparationRevision: 1, orderId, orderLineId: 'drug-1', calculatedAt: '2026-10-16T10:00:00Z', provider: { referringProviderId: 'referring', referringProviderDisplay: null, aggregatorId: 'aggregator', aggregatorDisplay: null, issuePaProviderId: 'issue-provider' }, medication: { sourceCode: 'SOURCE', sourceDescription: 'Medication', quantity: 4, dosage: null }, pricing: { approvedLineAmount: '500.00', currency: 'NGN', priceSource: 'approvedProcedurePrices' }, mapping: { sourceNamespaceId: 'namespace', mappingStatus: 'ACTIVE', mappedMediCloudCode: 'CANON', mappedMediCloudDescription: 'Canonical' }, validation: { member: 'VALID', memberFreshAsOf: null, memberFreshUntil: null, price: 'VALID', provider: 'VALID', mapping: 'VALID' }, preparationStatus: 'READY', reasonCodes: [], isStale: false, submissionEligible: true, transmission: { state: 'not_generated', verificationRequired: false, confirmedPaReference: null } }
const page = (items: PreparationRow[] = [line], nextCursor: string | null = null): LinePage => ({ items, nextCursor, counts: batch.counts, countsScope: 'LAST_CALCULATION', countsAsOf: null, pageCounts: { lines: items.length, stale: 0, submitted: 0, verificationRequired: 0 } })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listPreparationBatches).mockResolvedValue({ items: [batch], nextCursor: null })
  vi.mocked(api.getPreparationBatch).mockResolvedValue(batch)
  vi.mocked(api.listPreparationLines).mockResolvedValue(page())
  vi.mocked(api.createPreparationBatch).mockResolvedValue({ ...batch, version: 0 })
  vi.mocked(api.prepareOrder).mockResolvedValue({ batch: { ...batch, version: 4 }, items: [line] })
  vi.mocked(api.recalculatePreparation).mockResolvedValue({ batch: { ...batch, version: 4 }, items: [line] })
  vi.mocked(api.closePreparationBatch).mockResolvedValue({ ...batch, version: 4, status: 'CLOSED' })
})
async function ready() { await screen.findByRole('table', { name: 'PA preparation lines' }) }
function prepare() { fireEvent.change(screen.getByLabelText('Order ID'), { target: { value: orderId } }); fireEvent.click(screen.getByRole('button', { name: 'Prepare order' })) }
describe('Preparation permissions and batch creation', () => {
  it('does not fetch for staff without READ or WRITE', () => {
    render(<PreparationList userName="Staff" permissions={[]} />)
    expect(api.listPreparationBatches).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Create batch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'PA Preparation' })).not.toBeInTheDocument()
  })
  it('READ lists batches without mutation controls and preserves null historical counts', async () => {
    render(<PreparationList userName="Staff" permissions={['PA_PREPARATION_READ']} />)
    expect(await screen.findByRole('link', { name: `Open batch ${batchId}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create batch' })).not.toBeInTheDocument()
    expect(screen.getByText(/LAST_CALCULATION/)).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  })
  it('WRITE-only creates and receives results without arbitrary GET or navigation access', async () => {
    render(<PreparationList userName="Writer" permissions={['PA_PREPARATION_WRITE']} />)
    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: '2026-10-16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create batch' }))
    await screen.findByLabelText('Order ID')
    expect(api.createPreparationBatch).toHaveBeenCalledWith('2026-10-16')
    prepare()
    await screen.findByRole('region', { name: 'Mutation result' })
    expect(api.prepareOrder).toHaveBeenCalledWith(batchId, orderId, { expectedVersion: 0 })
    expect(api.listPreparationBatches).not.toHaveBeenCalled()
    expect(api.getPreparationBatch).not.toHaveBeenCalled()
    expect(api.listPreparationLines).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'PA Preparation' })).not.toBeInTheDocument()
  })
  it('navigates an empty batch page with its backend cursor', async () => {
    vi.mocked(api.listPreparationBatches).mockResolvedValueOnce({ items: [], nextCursor: 'opaque-cursor' })
    render(<PreparationList userName="Reader" permissions={['PA_PREPARATION_READ']} />)
    await screen.findByText('No batches on this page.')
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(api.listPreparationBatches).toHaveBeenLastCalledWith({ limit: 25, cursor: 'opaque-cursor' }))
    await screen.findByRole('link', { name: `Open batch ${batchId}` })
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    await waitFor(() => expect(api.listPreparationBatches).toHaveBeenLastCalledWith({ limit: 25, cursor: undefined }))
  })
  it('does not retry an ambiguous creation', async () => {
    vi.mocked(api.createPreparationBatch).mockRejectedValue(new ApiError(503, 'unsafe details'))
    render(<PreparationList userName="Writer" permissions={['PA_PREPARATION_WRITE']} />)
    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: '2026-10-16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create batch' }))
    await screen.findByText(/Creation outcome needs review/)
    expect(screen.getByRole('button', { name: 'Create batch' })).toBeDisabled()
    expect(api.createPreparationBatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('unsafe details')).not.toBeInTheDocument()
  })
  it.each([new TypeError('Failed to fetch'), new ApiError(408, 'timeout')])('keeps creation locked after a possibly delivered request (%s)', async error => {
    vi.mocked(api.createPreparationBatch).mockRejectedValue(error)
    render(<PreparationList userName="Writer" permissions={['PA_PREPARATION_WRITE']} />)
    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: '2026-10-16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create batch' }))
    await screen.findByText(/Creation outcome needs review/)
    expect(screen.getByRole('button', { name: 'Create batch' })).toBeDisabled()
    expect(api.createPreparationBatch).toHaveBeenCalledTimes(1)
  })
  it.each([
    [400, /Check the selected date or order identifier/],
    [403, /You do not have permission for this action/],
    [422, /Check the selected date or order identifier/],
  ] as const)('shows a definite %i creation rejection and allows an explicit retry', async (status, message) => {
    vi.mocked(api.createPreparationBatch).mockRejectedValueOnce(new ApiError(status, 'internal'))
    render(<PreparationList userName="Writer" permissions={['PA_PREPARATION_WRITE']} />)
    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: '2026-10-16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create batch' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(/Creation outcome needs review/)).not.toBeInTheDocument()
    expect(screen.queryByText('internal')).not.toBeInTheDocument()
    expect(api.createPreparationBatch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create batch' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Create batch' }))
    await screen.findByLabelText('Order ID')
    expect(api.createPreparationBatch).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })
  it('a rapid double submit sends a single creation request', async () => {
    let resolve: (value: PreparationBatch) => void = () => {}
    vi.mocked(api.createPreparationBatch).mockReturnValueOnce(new Promise(done => { resolve = done }))
    render(<PreparationList userName="Writer" permissions={['PA_PREPARATION_WRITE']} />)
    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: '2026-10-16' } })
    const button = screen.getByRole('button', { name: 'Create batch' })
    fireEvent.click(button); fireEvent.click(button)
    resolve({ ...batch, version: 0 })
    await screen.findByLabelText('Order ID')
    expect(api.createPreparationBatch).toHaveBeenCalledTimes(1)
  })
})
describe('Batch workspace', () => {
  it('uses the authoritative version for prepare and never accepts member evidence', async () => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready(); prepare()
    await waitFor(() => expect(api.prepareOrder).toHaveBeenCalledWith(batchId, orderId, { expectedVersion: 3 }))
    await waitFor(() => expect(api.getPreparationBatch).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText('Prepared data only — no PA submitted or authorized.')).toHaveLength(1)
  })
  it('recalculates explicitly with current version', async () => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready()
    fireEvent.click(screen.getByRole('button', { name: `Recalculate order ${orderId}` }))
    await waitFor(() => expect(api.recalculatePreparation).toHaveBeenCalledWith(batchId, orderId, { expectedVersion: 3 }))
  })
  it('requires confirmation before closing and explains ownership release', async () => {
    vi.mocked(api.getPreparationBatch).mockResolvedValueOnce(batch).mockResolvedValue({ ...batch, version: 4, status: 'CLOSED' })
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Close batch' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/ownership/i)).toBeInTheDocument()
    expect(api.closePreparationBatch).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(api.closePreparationBatch).toHaveBeenCalledWith(batchId, { expectedVersion: 3 }))
    await screen.findByText(/Closed — order ownership released/)
    expect(screen.getByRole('button', { name: 'Prepare order' })).toBeDisabled()
  })
  it('does not submit close when cancelled', async () => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Close batch' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(api.closePreparationBatch).not.toHaveBeenCalled()
  })
  it.each([new ApiError(409, 'internal', 'PREPARATION_DOMAIN_CONFLICT'), new ApiError(409, 'internal'), new ApiError(503, 'internal'), new TypeError('Failed to fetch')])('pauses mutations after conflict or unavailability without retries', async error => {
    vi.mocked(api.prepareOrder).mockRejectedValue(error)
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready(); prepare()
    await screen.findByText(/Actions are paused/)
    expect(screen.getByRole('button', { name: 'Prepare order' })).toBeDisabled()
    expect(api.prepareOrder).toHaveBeenCalledTimes(1)
    expect(api.getPreparationBatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('internal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload current batch' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare order' })).toBeEnabled())
  })
  it('preserves cursor navigation on empty filtered pages and sends safe filters', async () => {
    vi.mocked(api.listPreparationLines).mockResolvedValue(page([], 'next-line'))
    render(<BatchWorkspace batchId={batchId} canRead canWrite={false} />)
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(api.listPreparationLines).toHaveBeenLastCalledWith(batchId, { cursor: 'next-line', limit: 25 }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply filters' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'BLOCKED' } })
    fireEvent.change(screen.getByLabelText('Mapping status'), { target: { value: 'UNMAPPED' } })
    fireEvent.change(screen.getByLabelText('IssuePa provider ID'), { target: { value: ' provider ' } })
    fireEvent.change(screen.getByLabelText('Aggregator ID'), { target: { value: 'agg' } })
    fireEvent.change(screen.getByLabelText('Revision freshness'), { target: { value: 'true' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(api.listPreparationLines).toHaveBeenLastCalledWith(batchId, { cursor: undefined, limit: 25, status: 'BLOCKED', mappingStatus: 'UNMAPPED', providerId: 'provider', aggregatorId: 'agg', stale: true }))
  })
  it('ownership conflict shows the error without pausing actions or reloading', async () => {
    const otherBatch = '22222222-2222-4222-8222-222222222222'
    const otherOrder = 'abcdefabcdefabcdefabcdef'
    vi.mocked(api.prepareOrder).mockRejectedValueOnce(new ApiError(409, 'internal', 'ORDER_ALREADY_IN_ACTIVE_BATCH', otherBatch))
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready(); prepare()
    await screen.findByText(/belongs to another active preparation batch/)
    expect(screen.getByRole('link', { name: 'View owning batch' })).toHaveAttribute('href', `/staff/pa-preparation/${otherBatch}`)
    expect(screen.queryByText(/Actions are paused/)).not.toBeInTheDocument()
    expect(api.getPreparationBatch).toHaveBeenCalledTimes(1)
    // A different order can be prepared immediately, still with the unchanged batch version.
    fireEvent.change(screen.getByLabelText('Order ID'), { target: { value: otherOrder } })
    expect(screen.getByRole('button', { name: 'Prepare order' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare order' }))
    await waitFor(() => expect(api.prepareOrder).toHaveBeenLastCalledWith(batchId, otherOrder, { expectedVersion: 3 }))
    expect(api.prepareOrder).toHaveBeenCalledTimes(2)
  })
  it('ownership conflict for a WRITE-only user still exposes no batch link and keeps actions available', async () => {
    vi.mocked(api.prepareOrder).mockRejectedValueOnce(new ApiError(409, 'internal', 'ORDER_ALREADY_IN_ACTIVE_BATCH', null))
    render(<BatchWorkspace batchId={batchId} initialBatch={batch} canRead={false} canWrite />); prepare()
    await screen.findByText(/belongs to another active preparation batch/)
    expect(screen.queryByRole('link', { name: 'View owning batch' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Actions are paused/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare order' })).toBeEnabled()
  })
  it('limits provider and aggregator filter IDs to 100 characters', async () => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite={false} />); await ready()
    expect(screen.getByLabelText('IssuePa provider ID')).toHaveAttribute('maxLength', '100')
    expect(screen.getByLabelText('Aggregator ID')).toHaveAttribute('maxLength', '100')
  })
  it.each([422, 400])('rejected filters (%i) show a filter message without pausing mutations, then recover', async status => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready()
    vi.mocked(api.listPreparationLines).mockRejectedValueOnce(new ApiError(status, 'internal'))
    fireEvent.change(screen.getByLabelText('Aggregator ID'), { target: { value: 'rejected-by-server' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByText(/line filters were rejected/)).toBeInTheDocument()
    expect(screen.queryByText(/Actions are paused/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Check the selected date or order identifier/)).not.toBeInTheDocument()
    expect(screen.queryByText('internal')).not.toBeInTheDocument()
    // Batch state was refreshed successfully, so preparation remains available.
    prepare()
    await waitFor(() => expect(api.prepareOrder).toHaveBeenCalledWith(batchId, orderId, { expectedVersion: 3 }))
    // Correcting the filter clears the message and loads lines again.
    fireEvent.change(screen.getByLabelText('Aggregator ID'), { target: { value: 'agg' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply filters' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(api.listPreparationLines).toHaveBeenLastCalledWith(batchId, expect.objectContaining({ aggregatorId: 'agg' })))
    await waitFor(() => expect(screen.queryByText(/line filters were rejected/)).not.toBeInTheDocument())
    expect(await screen.findByRole('region', { name: 'Preparation lines' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Preparation lines' })).getByRole('table')).toBeInTheDocument()
  })
  it('still pauses mutations when the batch itself cannot be loaded, even with filters applied', async () => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite />); await ready()
    vi.mocked(api.getPreparationBatch).mockRejectedValueOnce(new ApiError(422, 'internal'))
    vi.mocked(api.listPreparationLines).mockRejectedValueOnce(new ApiError(422, 'internal'))
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'BLOCKED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    await screen.findByText(/Actions are paused/)
    expect(screen.queryByText(/line filters were rejected/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare order' })).toBeDisabled()
  })
  it('an unfiltered line-load rejection still pauses mutations', async () => {
    vi.mocked(api.listPreparationLines).mockRejectedValueOnce(new ApiError(422, 'internal'))
    render(<BatchWorkspace batchId={batchId} canRead canWrite />)
    await screen.findByText(/Actions are paused/)
    expect(screen.queryByText(/line filters were rejected/)).not.toBeInTheDocument()
  })
  it('READ-only never offers prepare, recalculate or close', async () => {
    render(<BatchWorkspace batchId={batchId} canRead canWrite={false} />); await ready()
    expect(screen.queryByRole('button', { name: /prepare order|recalculate order|close batch/i })).not.toBeInTheDocument()
  })
})
describe('Minimized fail-closed presentation', () => {
  it.each(['READY','REVIEW_REQUIRED','BLOCKED'] as const)('renders %s separately from transmission and preserves line total', status => {
    render(<PreparationTable rows={[{ ...line, preparationStatus: status, reasonCodes: status === 'BLOCKED' ? ['MEMBER_VALIDATION_UNAVAILABLE'] : [] }]} />)
    expect(screen.getByText(status)).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /NGN 500.00/ })).toBeInTheDocument()
    expect(screen.queryByText('NGN 2000.00')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Not submitted' })).toBeInTheDocument()
    if (status === 'BLOCKED') expect(screen.getByText(/Member validation is unavailable/)).toBeInTheDocument()
  })
  it('malformed row is blocked and missing values stay unavailable', () => {
    render(<PreparationTable rows={[{} as PreparationRow]} />)
    expect(screen.getByText('BLOCKED')).toBeInTheDocument()
    expect(screen.getByText('PREPARATION_ROW_INVALID')).toBeInTheDocument()
    expect(screen.getByText('Unknown — verification required')).toBeInTheDocument()
  })
  it('stale READY cannot appear current', () => {
    render(<PreparationTable rows={[{ ...line, isStale: true }]} />)
    expect(screen.getByText('REVIEW_REQUIRED')).toBeInTheDocument()
    expect(screen.getByText('Stale preparation')).toBeInTheDocument()
  })
  it('does not render arbitrary PHI, raw evidence, credentials or internal hashes', () => {
    render(<PreparationTable rows={[{ ...line, memberName: 'PRIVATE_NAME', rawResponse: 'RAW_SECRET', inputFingerprint: 'HASH_SECRET', password: 'PASSWORD_SECRET' } as PreparationLine]} />)
    expect(document.body.textContent).not.toMatch(/PRIVATE_NAME|RAW_SECRET|HASH_SECRET|PASSWORD_SECRET/)
  })
  it.each([401,403,404,409,503])('renders sanitized %s errors', status => {
    render(<PreparationError error={new ApiError(status, 'sensitive error')} canRead={false} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('sensitive error')).not.toBeInTheDocument()
  })
  it('WRITE-only ownership errors do not expose a batch link', () => {
    render(<PreparationError error={new ApiError(409, 'private', 'ORDER_ALREADY_IN_ACTIVE_BATCH', batchId)} canRead={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
