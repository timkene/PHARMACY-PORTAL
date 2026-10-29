import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as api from '@/lib/pa-api'
import { ApiError } from '@/lib/api'
import { getStaffSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { CatalogMetadata, MappingProposal } from '@/lib/pa-types'
import { ProposalDetail } from '../ProposalDetail'
import { ProposalList } from '../ProposalList'
import MappingProposalsPage from '@/app/staff/pa-mapping-proposals/page'
import MappingProposalDetailPage from '@/app/staff/pa-mapping-proposals/[proposalId]/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), usePathname: () => '/staff/pa-mapping-proposals', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ getStaffSession: vi.fn() }))
vi.mock('@/lib/pa-api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pa-api')>()
  return { ...actual, listMappingProposals: vi.fn(), getMappingProposal: vi.fn(), rejectMappingProposal: vi.fn(), approveMappingProposal: vi.fn(), activateMappingProposal: vi.fn() }
})

const proposalId = '11111111-1111-4111-8111-111111111111'
const catalog: CatalogMetadata = {
  snapshotId: 'catalog', status: 'TRUSTED', source: 'MEDICLOUD_PROCEDUREDATA', sourceExtractedAt: null,
  importedAt: null, validatedAt: null, trustedAt: null, revokedAt: null, recordCount: 1, schemaVersion: 1,
  revoked: false, integrityStatus: 'VERIFIED', trustStatus: 'TRUSTED',
  actors: { uploader: { state: 'COMPLETED', staffId: 'uploader', at: 'time' }, validator: { state: 'COMPLETED', staffId: 'validator', at: 'time' }, truster: { state: 'COMPLETED', staffId: 'truster', at: 'time' } },
  freshness: { evaluatedAt: 'time', expiresAt: 'time', maximumAgeHours: 24, state: 'FRESH' },
  usableForNewAuthorization: true, usableForExistingResolution: true,
  providerTariffEligibility: 'NOT_VERIFIED', coverageEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED',
}
const proposed: MappingProposal = {
  proposalId, mappingId: 'map', version: 2, sourceNamespaceId: 'ns', sourceIdentityType: 'CODE', sourceIdentityKey: 'SRC',
  sourceCode: 'SRC', sourceDescription: 'Source med', proposedMedicloudCode: 'DRG-CANON', proposedMedicloudDescription: 'Canonical medication A',
  mappingNotes: 'Review', provenance: 'CURSOR_PROPOSAL', workflowStatus: 'PROPOSED', recordedWorkflowStatus: 'PROPOSED',
  workflowVerification: 'VERIFIED', evidenceScope: 'FULL_VERIFICATION', expectedHeadVersion: 3, expectedActiveVersion: null,
  actors: { importer: { state: 'COMPLETED', staffId: 'importer', at: 'time' }, approver: { state: 'PENDING', staffId: null, at: null }, activator: { state: 'PENDING', staffId: null, at: null } },
  decision: { state: 'PENDING', staffId: null, at: null, outcome: null }, threePersonStatus: 'PENDING',
  catalog: { ...catalog, binding: 'LATEST_TRUSTED', verificationScope: 'FULL_VERIFICATION' },
  catalogVerification: 'VERIFIED', catalogVerificationPurpose: 'NEW_AUTHORIZATION',
  canonicalCode: 'DRG-CANON', canonicalDescription: 'Canonical medication A',
  providerTariffEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listMappingProposals).mockResolvedValue({ items: [{ ...proposed, evidenceScope: 'METADATA_ONLY', catalog: { ...proposed.catalog, verificationScope: 'METADATA_ONLY' } }], nextCursor: null })
  vi.mocked(api.getMappingProposal).mockResolvedValue(proposed)
  vi.mocked(api.approveMappingProposal).mockResolvedValue({ proposalId, mappingId: 'map', status: 'APPROVED', lifecycleVersion: 2, decidedAt: 'time', activatedAt: null, snapshotId: 'catalog' })
  vi.mocked(api.rejectMappingProposal).mockResolvedValue({ proposalId, mappingId: 'map', status: 'REJECTED', lifecycleVersion: 2, decidedAt: 'time', activatedAt: null, snapshotId: null })
  vi.mocked(api.activateMappingProposal).mockResolvedValue({ proposalId, mappingId: 'map', status: 'ACTIVATED', lifecycleVersion: 2, decidedAt: null, activatedAt: 'time', snapshotId: 'catalog' })
})

describe('permissions', () => {
  it('redirects unauthenticated staff', async () => {
    vi.mocked(getStaffSession).mockResolvedValue(null)
    await expect(MappingProposalsPage()).rejects.toThrow('REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/staff/login')
  })
  it('does not fetch detail without REVIEW', async () => {
    vi.mocked(getStaffSession).mockResolvedValue({ userId: 'u', name: 'Staff', email: '', permissions: ['PA_MAPPING_APPROVE'] })
    render(await MappingProposalDetailPage({ params: Promise.resolve({ proposalId }) }))
    expect(screen.getByRole('alert')).toHaveTextContent('PA_MAPPING_REVIEW')
    expect(api.getMappingProposal).not.toHaveBeenCalled()
  })
})

describe('list and detail', () => {
  it('treats list rows as metadata and does not approve from the list', async () => {
    render(<ProposalList userName="Staff" permissions={['PA_MAPPING_REVIEW', 'PA_MAPPING_APPROVE']} />)
    await waitFor(() => expect(screen.getByText(/open detail to verify/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Approve proposal' })).not.toBeInTheDocument()
  })
  it('approves from verified detail with expected versions and a new requestId', async () => {
    render(<ProposalDetail proposalId={proposalId} userId="approver" userName="Approver" permissions={['PA_MAPPING_REVIEW', 'PA_MAPPING_APPROVE']} />)
    await screen.findByText('Proposed mapping — not approved')
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Reviewed against canonical catalog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve proposal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    await waitFor(() => expect(api.approveMappingProposal).toHaveBeenCalledTimes(1))
    const body = vi.mocked(api.approveMappingProposal).mock.calls[0][1]
    expect(body).toMatchObject({ expectedHeadVersion: 3, expectedActiveVersion: null, reason: 'Reviewed against canonical catalog' })
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(body).not.toHaveProperty('actorId')
  })
  it('keeps approve disabled for the importer and without APPROVE permission', async () => {
    render(<ProposalDetail proposalId={proposalId} userId="importer" userName="Importer" permissions={['PA_MAPPING_REVIEW', 'PA_MAPPING_APPROVE']} />)
    await screen.findByText(/importer cannot approve/i)
    expect(screen.getByRole('button', { name: 'Approve proposal' })).toBeDisabled()
    render(<ProposalDetail proposalId={proposalId} userId="approver" userName="Approver" permissions={['PA_MAPPING_REVIEW']} />)
    await screen.findAllByText('Proposed mapping — not approved')
    expect(screen.getAllByRole('button', { name: 'Approve proposal' })[1]).toBeDisabled()
  })
  it('rejects without activating and explains 403', async () => {
    vi.mocked(api.rejectMappingProposal).mockRejectedValue(new ApiError(403, 'Forbidden'))
    render(<ProposalDetail proposalId={proposalId} userId="reviewer" userName="Reviewer" permissions={['PA_MAPPING_REVIEW']} />)
    await screen.findByText('Proposed mapping — not approved')
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Does not match catalog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission'))
    expect(api.activateMappingProposal).not.toHaveBeenCalled()
  })
  it('does not retry a stale 409 and requires reload', async () => {
    vi.mocked(api.approveMappingProposal).mockRejectedValue(new ApiError(409, 'Changed', 'MAPPING_HEAD_CHANGED'))
    render(<ProposalDetail proposalId={proposalId} userId="approver" userName="Approver" permissions={['PA_MAPPING_REVIEW', 'PA_MAPPING_APPROVE']} />)
    await screen.findByText('Proposed mapping — not approved')
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Reviewed against canonical catalog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve proposal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('mapping head changed'))
    expect(api.approveMappingProposal).toHaveBeenCalledTimes(1)
  })
  it('locks after an uncertain 500 until evidence is reloaded', async () => {
    vi.mocked(api.approveMappingProposal).mockRejectedValue(new ApiError(500, 'down'))
    vi.mocked(api.getMappingProposal).mockResolvedValueOnce(proposed).mockResolvedValueOnce(proposed)
    render(<ProposalDetail proposalId={proposalId} userId="approver" userName="Approver" permissions={['PA_MAPPING_REVIEW', 'PA_MAPPING_APPROVE']} />)
    await screen.findByText('Proposed mapping — not approved')
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Reviewed against canonical catalog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve proposal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    await waitFor(() => expect(screen.getByText(/outcome is unknown/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Approve proposal' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload current evidence' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve proposal' })).toBeEnabled())
  })
  it('activates only a verified approval and never from recorded ACTIVE metadata', async () => {
    const approved = { ...proposed, workflowStatus: 'APPROVED' as const, recordedWorkflowStatus: 'APPROVED' as const, catalogVerificationPurpose: 'NEW_AUTHORIZATION' as const }
    vi.mocked(api.getMappingProposal).mockResolvedValue(approved)
    render(<ProposalDetail proposalId={proposalId} userId="activator" userName="Activator" permissions={['PA_MAPPING_REVIEW', 'PA_MAPPING_ACTIVATE']} />)
    await screen.findByText(/activation is a separate action/i)
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Activate after independent approval' } })
    fireEvent.click(screen.getByRole('button', { name: 'Activate mapping' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm activation' }))
    await waitFor(() => expect(api.activateMappingProposal).toHaveBeenCalledTimes(1))
  })
})
