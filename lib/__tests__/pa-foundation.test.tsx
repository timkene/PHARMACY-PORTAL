import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StaffShell } from '@/components/staff/StaffShell'
import { PA_PERMISSIONS, parsePaPermissions, hasPaPermission, paNavigation } from '../pa-permissions'
import { proposalPresentation, catalogPresentation, preparationLabel } from '../pa-presentation'
import type { MappingProposal, CatalogMetadata, PreparationLine } from '../pa-types'
vi.mock('next/navigation', () => ({ usePathname: () => '/staff/dashboard', useRouter: () => ({ push: vi.fn() }) }))

const catalog: CatalogMetadata = {
  snapshotId: 'catalog', status: 'TRUSTED', source: 'MEDICLOUD_PROCEDUREDATA', sourceExtractedAt: null,
  importedAt: null, validatedAt: null, trustedAt: null, revokedAt: null, recordCount: 1, schemaVersion: 1,
  revoked: false, integrityStatus: 'VERIFIED', trustStatus: 'TRUSTED',
  actors: { uploader: { state: 'COMPLETED', staffId: 'uploader', at: 'time' }, validator: { state: 'COMPLETED', staffId: 'validator', at: 'time' }, truster: { state: 'COMPLETED', staffId: 'truster', at: 'time' } },
  freshness: { evaluatedAt: 'time', expiresAt: 'time', maximumAgeHours: 24, state: 'FRESH' },
  usableForNewAuthorization: true, usableForExistingResolution: true,
  providerTariffEligibility: 'NOT_VERIFIED', coverageEligibility: 'NOT_VERIFIED', priceApplicability: 'NOT_VERIFIED',
}
const active = {
  workflowStatus: 'ACTIVE', recordedWorkflowStatus: 'ACTIVE', workflowVerification: 'VERIFIED',
  evidenceScope: 'FULL_VERIFICATION', threePersonStatus: 'VALID', catalogVerification: 'VERIFIED',
  catalogVerificationPurpose: 'EXISTING_ACTIVE_RESOLUTION', catalog: { ...catalog, verificationScope: 'FULL_VERIFICATION' },
} as MappingProposal

it('filters authoritative permission lists without role inference or inheritance', () => {
  expect(parsePaPermissions(['PA_MAPPING_REVIEW', 'admin', {}, 'PA_MAPPING_REVIEW'])).toEqual(['PA_MAPPING_REVIEW'])
  expect(parsePaPermissions({ permissions: PA_PERMISSIONS })).toEqual([])
  expect(hasPaPermission(['PA_CATALOG_TRUST'], 'PA_CATALOG_READ')).toBe(false)
  expect(hasPaPermission(['PA_PREPARATION_WRITE'], 'PA_PREPARATION_READ')).toBe(false)
  expect(paNavigation(['PA_MAPPING_APPROVE', 'PA_MAPPING_ACTIVATE'])).toHaveLength(0)
  expect(paNavigation(['PA_MAPPING_IMPORT'])).toHaveLength(1)
})

it('preserves existing navigation for staff without PA permissions and performs no request', () => {
  render(<StaffShell userName="Staff">Existing screen</StaffShell>)
  expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/staff/dashboard')
  expect(screen.getByRole('link', { name: /new intake/i })).toHaveAttribute('href', '/staff/intake/new')
  expect(screen.queryByText(/PA Preparation/)).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

it('shows only permitted upcoming entries, with no broken links or screen implementation', () => {
  render(<StaffShell userName="Staff" permissions={['PA_PREPARATION_READ', 'PA_CATALOG_READ']}>Existing screen</StaffShell>)
  expect(screen.getByText(/PA Preparation/)).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText(/Procedure Catalog/)).toHaveAttribute('aria-disabled', 'true')
  expect(screen.queryByText(/Mapping Proposals/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(2)
})

describe('fail-closed presentation', () => {
  it('never treats proposal list metadata or recorded ACTIVE as verified', () => {
    const result = proposalPresentation({ ...active, evidenceScope: 'METADATA_ONLY', workflowStatus: 'UNVERIFIED', workflowVerification: 'NOT_EVALUATED' })
    expect(result.verified).toBe(false); expect(result.label).toContain('open detail')
    expect(proposalPresentation({ ...active, catalog: { ...active.catalog, verificationScope: 'METADATA_ONLY' } }).verified).toBe(false)
  })
  it('distinguishes expired existing ACTIVE validity from new authorization evidence', () => {
    const expired = { ...catalog, usableForNewAuthorization: false, freshness: { ...catalog.freshness, state: 'EXPIRED' as const } }
    const result = proposalPresentation({ ...active, catalogVerification: 'VERIFIED_FOR_EXISTING_ACTIVE', catalog: { ...active.catalog, ...expired } })
    expect(result.verified).toBe(true); expect(result.label).toContain('fresh evidence required')
    expect(catalogPresentation(expired, 'FULL_VERIFICATION')).toMatchObject({ existingResolution: true, newAuthorizationEvidence: false })
  })
  it.each(['INVALID', 'UNAVAILABLE', 'NOT_EVALUATED'] as const)('does not trust %s catalog integrity', integrityStatus => {
    const invalid = { ...catalog, integrityStatus }
    expect(catalogPresentation(invalid, 'FULL_VERIFICATION').newAuthorizationEvidence).toBe(false)
    expect(proposalPresentation({ ...active, catalog: { ...active.catalog, ...invalid } }).verified).toBe(false)
  })
  it('never treats replaced history or invalid actors as current authorization', () => {
    expect(proposalPresentation({ ...active, recordedWorkflowStatus: 'REPLACED' })).toEqual({ label: 'Historical mapping — replaced', verified: false })
    expect(proposalPresentation({ ...active, threePersonStatus: 'INVALID' }).verified).toBe(false)
    expect(proposalPresentation({ ...active, workflowVerification: 'INVALID' }).verified).toBe(false)
  })
  it('keeps approvals separate from activation and denies stale new-authorization display', () => {
    const approved = { ...active, workflowStatus: 'APPROVED' as const, recordedWorkflowStatus: 'APPROVED' as const, catalogVerificationPurpose: 'NEW_AUTHORIZATION' as const }
    expect(proposalPresentation(approved).label).toContain('separate action')
    expect(proposalPresentation({ ...approved, catalog: { ...approved.catalog, usableForNewAuthorization: false } }).verified).toBe(false)
  })
  it('catalog metadata alone is never usable, even with contradictory recorded flags', () => {
    expect(catalogPresentation(catalog, 'METADATA_ONLY')).toMatchObject({ existingResolution: false, newAuthorizationEvidence: false })
    expect(catalogPresentation({ ...catalog, revoked: true }, 'FULL_VERIFICATION').existingResolution).toBe(false)
  })
  it('READY never becomes submission authorization and stale rows require recalculation', () => {
    expect(preparationLabel({ preparationStatus: 'READY', isStale: false } as PreparationLine)).toContain('no PA submitted or authorized')
    expect(preparationLabel({ preparationStatus: 'READY', isStale: true } as PreparationLine)).toContain('recalculate')
  })
})


it('treats malformed-row placeholders as blocked/stale, without assuming complete medication data', () => {
  expect(preparationLabel({ batchId: 'batch', preparationLineId: null, orderId: null,
    preparationStatus: 'BLOCKED', reasonCodes: ['PREPARATION_ROW_INVALID'], isStale: true, submissionEligible: false,
    provider: {}, medication: {}, pricing: {}, mapping: { mappingStatus: 'UNMAPPED', mappedMediCloudCode: null, mappedMediCloudDescription: null },
    validation: { member: 'UNAVAILABLE' }, transmission: { state: 'UNKNOWN', verificationRequired: true, confirmedPaReference: null },
  })).toContain('recalculate')
})
