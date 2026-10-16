/** Read-only display interpretation. These helpers never grant action authority. */
import type { MappingProposal, CatalogMetadata, ProposalCatalog, PreparationRow } from './pa-types'
export function proposalPresentation(proposal: MappingProposal) {
  const metadataOnly = proposal.evidenceScope !== 'FULL_VERIFICATION' || proposal.catalog?.verificationScope !== 'FULL_VERIFICATION'
  if (metadataOnly) return { label: 'Recorded status — open detail to verify', verified: false }
  if (proposal.workflowStatus === 'REPLACED' || proposal.recordedWorkflowStatus === 'REPLACED') {
    return { label: 'Historical mapping — replaced', verified: false }
  }
  if (proposal.workflowVerification !== 'VERIFIED' || proposal.workflowStatus === 'UNVERIFIED' || proposal.threePersonStatus === 'INVALID') {
    return { label: 'Workflow evidence unavailable or invalid', verified: false }
  }
  if (proposal.workflowStatus === 'ACTIVE' && proposal.catalogVerificationPurpose === 'EXISTING_ACTIVE_RESOLUTION'
      && proposal.catalog?.integrityStatus === 'VERIFIED' && proposal.catalog.trustStatus === 'TRUSTED'
      && !proposal.catalog.revoked && proposal.catalog.usableForExistingResolution
      && proposal.recordedWorkflowStatus === 'ACTIVE' && proposal.threePersonStatus === 'VALID'
      && ['VERIFIED', 'VERIFIED_FOR_EXISTING_ACTIVE'].includes(proposal.catalogVerification)) {
    return { label: proposal.catalog.freshness.state === 'EXPIRED'
      ? 'Active mapping verified; fresh evidence required for new authorization' : 'Active mapping verified', verified: true }
  }
  if (proposal.workflowStatus === 'ACTIVE') return { label: 'Active mapping evidence unavailable', verified: false }
  if (proposal.workflowStatus === 'APPROVED') {
    const fresh = catalogPresentation(proposal.catalog, 'FULL_VERIFICATION').newAuthorizationEvidence
    return { label: fresh && proposal.catalogVerification === 'VERIFIED' && proposal.catalogVerificationPurpose === 'NEW_AUTHORIZATION'
      ? 'Approval recorded — activation is a separate action' : 'Approval evidence unavailable for new authorization',
      verified: fresh && proposal.catalogVerification === 'VERIFIED' && proposal.catalogVerificationPurpose === 'NEW_AUTHORIZATION' }
  }
  if (proposal.workflowStatus === 'PROPOSED') return { label: 'Proposed mapping — not approved', verified: true }
  if (proposal.workflowStatus === 'REJECTED') return { label: 'Proposal rejected', verified: true }
  return { label: 'Workflow evidence unavailable or invalid', verified: false }
}
export function catalogPresentation(catalog: CatalogMetadata | ProposalCatalog, scope: 'METADATA_ONLY' | 'FULL_VERIFICATION') {
  if (scope === 'METADATA_ONLY') return { label: 'Catalog metadata — open detail to verify', existingResolution: false, newAuthorizationEvidence: false }
  const existing = catalog.integrityStatus === 'VERIFIED' && catalog.trustStatus === 'TRUSTED'
    && !catalog.revoked && catalog.usableForExistingResolution === true
  const fresh = existing && catalog.usableForNewAuthorization === true && catalog.freshness?.state === 'FRESH'
  return { label: existing ? fresh ? 'Trusted catalog; fresh evidence' : 'Trusted catalog; new authorization needs fresh evidence'
    : 'Catalog evidence unavailable or invalid', existingResolution: existing, newAuthorizationEvidence: fresh }
}
export function preparationLabel(line: PreparationRow) {
  return line.isStale ? 'Stale preparation — recalculate' : line.preparationStatus === 'READY'
    ? 'Prepared data ready — no PA submitted or authorized' : line.preparationStatus
}
