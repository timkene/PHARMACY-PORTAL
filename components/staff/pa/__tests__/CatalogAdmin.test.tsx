import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as api from '@/lib/pa-api'
import { ApiError } from '@/lib/api'
import { getStaffSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { CatalogMetadata } from '@/lib/pa-types'
import { CatalogWorkspace } from '../CatalogWorkspace'
import { CatalogDetail } from '../CatalogDetail'
import CatalogPage from '@/app/staff/pa-catalog/page'
import CatalogDetailPage from '@/app/staff/pa-catalog/[snapshotId]/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), usePathname: () => '/staff/pa-catalog', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ getStaffSession: vi.fn() }))
vi.mock('@/lib/pa-api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pa-api')>()
  return { ...actual, listCatalogSnapshots: vi.fn(), getCatalogSnapshot: vi.fn(), ingestSignedCatalog: vi.fn(), validateCatalogSnapshot: vi.fn(), trustCatalogSnapshot: vi.fn(), readSignedCatalog: vi.fn() }
})

const snapshotId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const catalog: CatalogMetadata = {
  snapshotId, status: 'VALIDATED', source: 'MEDICLOUD_PROCEDUREDATA', sourceExtractedAt: 'time',
  importedAt: 'time', validatedAt: 'time', trustedAt: null, revokedAt: null, recordCount: 1, schemaVersion: 1,
  revoked: false, integrityStatus: 'VERIFIED', trustStatus: 'UNTRUSTED',
  actors: { uploader: { state: 'COMPLETED', staffId: 'uploader', at: 'time' }, validator: { state: 'COMPLETED', staffId: 'validator', at: 'time' }, truster: { state: 'PENDING', staffId: null, at: null } },
  freshness: { evaluatedAt: 'time', expiresAt: 'time', maximumAgeHours: 24, state: 'FRESH' },
  usableForNewAuthorization: false, usableForExistingResolution: false,
  providerTariffEligibility: 'NOT_VERIFIED', coverageEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listCatalogSnapshots).mockResolvedValue({ items: [{ ...catalog, integrityStatus: 'NOT_EVALUATED' }], nextCursor: null, skippedInvalidRecords: 0, integrityScope: 'METADATA_ONLY' })
  vi.mocked(api.getCatalogSnapshot).mockResolvedValue(catalog)
  vi.mocked(api.ingestSignedCatalog).mockResolvedValue({ snapshotId, source: 'MEDICLOUD_PROCEDUREDATA', sourceExtractedAt: 'time', importedAt: 'time', recordCount: 1, status: 'VALIDATED', schemaVersion: 1, providerTariffEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED' })
  vi.mocked(api.validateCatalogSnapshot).mockResolvedValue({ snapshotId, validationEvidenceId: snapshotId, status: 'EVIDENCE_VALIDATED' })
  vi.mocked(api.trustCatalogSnapshot).mockResolvedValue({ snapshotId, source: 'MEDICLOUD_PROCEDUREDATA', sourceExtractedAt: 'time', importedAt: 'time', recordCount: 1, status: 'TRUSTED', schemaVersion: 1, providerTariffEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED' })
})

it('redirects unauthenticated catalog staff', async () => {
  vi.mocked(getStaffSession).mockResolvedValue(null)
  await expect(CatalogPage()).rejects.toThrow('REDIRECT')
  expect(redirect).toHaveBeenCalledWith('/staff/login')
})

it('does not open snapshot verification without READ', async () => {
  vi.mocked(getStaffSession).mockResolvedValue({ userId: 'u', name: 'Staff', email: '', permissions: ['PA_CATALOG_TRUST'] })
  render(await CatalogDetailPage({ params: Promise.resolve({ snapshotId }) }))
  expect(screen.getByRole('alert')).toHaveTextContent('PA_CATALOG_READ')
  expect(api.getCatalogSnapshot).not.toHaveBeenCalled()
})

it('lets INGEST-only staff upload without listing snapshots', async () => {
  const bytes = new Uint8Array([123, 125])
  vi.mocked(api.readSignedCatalog).mockResolvedValue(bytes)
  render(<CatalogWorkspace userName="Staff" permissions={['PA_CATALOG_INGEST']} />)
  fireEvent.change(screen.getByLabelText('Signed JSON artifact'), { target: { files: [new File([bytes], 'signed.json', { type: 'application/json' })] } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Upload signed catalog' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Upload signed catalog' }))
  await waitFor(() => expect(api.ingestSignedCatalog).toHaveBeenCalledWith(bytes))
  expect(api.listCatalogSnapshots).not.toHaveBeenCalled()
  expect(screen.getByText(/does not grant trust/i)).toBeInTheDocument()
})

it('keeps list metadata from authorizing trust', async () => {
  render(<CatalogWorkspace userName="Staff" permissions={['PA_CATALOG_READ', 'PA_CATALOG_TRUST']} />)
  await waitFor(() => expect(screen.getByText(/open detail to verify/i)).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Trust snapshot' })).not.toBeInTheDocument()
})

it('trusts only from verified detail with a separate truster', async () => {
  render(<CatalogDetail snapshotId={snapshotId} userId="truster" userName="Truster" permissions={['PA_CATALOG_READ', 'PA_CATALOG_TRUST']} />)
  await screen.findByRole('region', { name: 'Verified catalog' })
  fireEvent.click(screen.getByRole('button', { name: 'Trust snapshot' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm trust' }))
  await waitFor(() => expect(api.trustCatalogSnapshot).toHaveBeenCalledWith(snapshotId))
})

it('blocks the uploader from trusting and explains 403', async () => {
  render(<CatalogDetail snapshotId={snapshotId} userId="uploader" userName="Uploader" permissions={['PA_CATALOG_READ', 'PA_CATALOG_TRUST']} />)
  await screen.findByText(/uploader cannot validate or trust/i)
  expect(screen.getByRole('button', { name: 'Trust snapshot' })).toBeDisabled()
  vi.mocked(api.trustCatalogSnapshot).mockRejectedValue(new ApiError(403, 'Forbidden'))
  render(<CatalogDetail snapshotId={snapshotId} userId="truster" userName="Truster" permissions={['PA_CATALOG_READ', 'PA_CATALOG_TRUST']} />)
  await screen.findAllByRole('region', { name: 'Verified catalog' })
  fireEvent.click(screen.getAllByRole('button', { name: 'Trust snapshot' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Confirm trust' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission'))
})

it('blocks the uploader from validating without VALIDATE permission', async () => {
  render(<CatalogDetail snapshotId={snapshotId} userId="uploader" userName="Uploader" permissions={['PA_CATALOG_READ']} />)
  await screen.findByRole('region', { name: 'Verified catalog' })
  expect(screen.getByRole('button', { name: 'Validate snapshot' })).toBeDisabled()
  expect(screen.getByText('PA_CATALOG_VALIDATE is required to validate.')).toBeInTheDocument()
  expect(screen.getByText(/uploader cannot validate or trust/i)).toBeInTheDocument()
  expect(api.validateCatalogSnapshot).not.toHaveBeenCalled()
  expect(screen.queryByText(/Validation evidence recorded/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Trust mutation status/)).not.toBeInTheDocument()
})

it('blocks the validator from trusting without TRUST permission', async () => {
  render(<CatalogDetail snapshotId={snapshotId} userId="validator" userName="Validator" permissions={['PA_CATALOG_READ', 'PA_CATALOG_VALIDATE']} />)
  await screen.findByRole('region', { name: 'Verified catalog' })
  expect(screen.getByRole('button', { name: 'Trust snapshot' })).toBeDisabled()
  expect(screen.getByText('PA_CATALOG_TRUST is required to trust.')).toBeInTheDocument()
  expect(screen.getByText(/validator cannot trust/i)).toBeInTheDocument()
  expect(api.trustCatalogSnapshot).not.toHaveBeenCalled()
  expect(screen.queryByText(/Trust mutation status/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Validation evidence recorded/)).not.toBeInTheDocument()
})

it('does not show catalog success after a 403 permission failure', async () => {
  vi.mocked(api.validateCatalogSnapshot).mockRejectedValue(new ApiError(403, 'Catalog permission required'))
  render(<CatalogDetail snapshotId={snapshotId} userId="validator-2" userName="Validator" permissions={['PA_CATALOG_READ', 'PA_CATALOG_VALIDATE']} />)
  await screen.findByRole('region', { name: 'Verified catalog' })
  fireEvent.click(screen.getByRole('button', { name: 'Validate snapshot' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm validation' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission'))
  expect(api.validateCatalogSnapshot).toHaveBeenCalledTimes(1)
  expect(screen.queryByText(/Validation evidence recorded/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Trust mutation status/)).not.toBeInTheDocument()
})

it('does not retry stale catalog 409 responses', async () => {
  vi.mocked(api.validateCatalogSnapshot).mockRejectedValue(new ApiError(409, 'Expired', 'CATALOG_EXPIRED'))
  render(<CatalogDetail snapshotId={snapshotId} userId="validator-2" userName="Validator" permissions={['PA_CATALOG_READ', 'PA_CATALOG_VALIDATE']} />)
  await screen.findByRole('region', { name: 'Verified catalog' })
  fireEvent.click(screen.getByRole('button', { name: 'Validate snapshot' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm validation' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('expired'))
  expect(api.validateCatalogSnapshot).toHaveBeenCalledTimes(1)
})
