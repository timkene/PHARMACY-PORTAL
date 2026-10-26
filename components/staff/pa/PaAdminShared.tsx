import { ApiError } from '@/lib/api'
import { outcomeUncertain } from './MappingReviewShared'
import type { ActorStep, CatalogMetadata, MappingProposal, ProposalCatalog } from '@/lib/pa-types'
import { catalogPresentation, proposalPresentation } from '@/lib/pa-presentation'
import { safeText, timeText } from './PreparationShared'

export { outcomeUncertain }
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ORDER_ID_RE = /^[a-f\d]{24}$/i
export const newRequestId = () => crypto.randomUUID()
export const reasonValid = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length >= 1 && trimmed.length <= 500 && ![...trimmed].some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)
}

const messages: Record<string, string> = {
  PROPOSAL_NOT_FOUND: 'This proposal was not found.',
  PROPOSAL_ALREADY_DECIDED: 'This proposal has already been decided.',
  PROPOSAL_ALREADY_ACTIVATED: 'This proposal has already been activated.',
  PROPOSAL_SUPERSEDED: 'A newer proposal replaced this one. Reload current evidence.',
  APPROVED_PROPOSAL_REQUIRED: 'Activation needs a currently approved proposal.',
  MAPPING_HEAD_CHANGED: 'The mapping head changed. Reload expected versions before another action.',
  APPROVAL_HEAD_CHANGED: 'Approval evidence changed. Reload before another action.',
  EXPLICIT_ACTIVE_REPLACEMENT_REQUIRED: 'An ACTIVE mapping already exists. Confirm replacement explicitly.',
  ACTIVE_MAPPING_REQUIRES_RETIREMENT_OR_REPLACEMENT: 'The current ACTIVE mapping must be replaced or retired first.',
  CATALOG_NOT_FOUND: 'This catalog snapshot was not found.',
  CATALOG_EXPIRED: 'Trusted catalog evidence is expired for new authorization.',
  TRUSTED_PROCEDURE_SNAPSHOT_REQUIRED: 'A trusted procedure catalog snapshot is required.',
  COMPLETE_VALIDATED_CATALOG_REQUIRED: 'A complete validated catalog is required before trust.',
  CATALOG_TRUST_CONFLICT: 'Catalog trust could not be recorded. Reload current snapshot status.',
  CATALOG_ARTIFACT_INVALID: 'The signed catalog artifact was rejected.',
  CATALOG_SIGNATURE_INVALID: 'The catalog signature is invalid.',
  TRANSACTION_CONFLICT_REFRESH_REQUIRED: 'The result is unknown because of a concurrent change. Check current state before trying again.',
}

export function adminErrorText(error: unknown, unavailable: string) {
  if (error instanceof ApiError) {
    if (error.code && messages[error.code]) return messages[error.code]
    if (error.status === 401) return 'Your staff session has expired. Sign in again.'
    if (error.status === 403) return 'You do not have permission for this independent staff action.'
    if (error.status === 404) return 'The record was not found.'
    if (error.status === 409) return 'Current evidence changed or this action is no longer available. Reload before another action. No retry was sent.'
    if (error.status === 422 || error.status === 400) return 'Check the submitted values. No retry was sent.'
    if (error.status >= 500) return `${unavailable} The result may be unknown; no automatic retry was sent.`
  }
  return `Unable to reach the service. The result may be unknown; no automatic retry was sent.`
}

export function AdminError({ error, unavailable }: { error: unknown; unavailable: string }) {
  return <p role="alert" className="border border-error rounded p-3 text-error">{adminErrorText(error, unavailable)}</p>
}

export function ActorAudit({ label, step }: { label: string; step: ActorStep | undefined }) {
  return <p>{label}: {step?.state === 'COMPLETED' ? <>{safeText(step.staffId)} · {timeText(step.at)}</> : safeText(step?.state ?? 'Unavailable')}</p>
}

export function CatalogAudit({ catalog, scope }: { catalog: CatalogMetadata | ProposalCatalog; scope: 'METADATA_ONLY' | 'FULL_VERIFICATION' }) {
  const shown = catalogPresentation(catalog, scope)
  return <section aria-label="Catalog evidence" className="space-y-1">
    <p>{shown.label}</p>
    <p>Status: {safeText(catalog.status)} · Integrity: {safeText(catalog.integrityStatus)} · Trust: {safeText(catalog.trustStatus)}</p>
    <p>Freshness: {safeText(catalog.freshness?.state)} · {shown.newAuthorizationEvidence ? 'Fresh trusted evidence recorded' : 'New authorization evidence unavailable'}</p>
    <p>Provider tariff / coverage / price: {safeText(catalog.providerTariffEligibility)} / {safeText(catalog.coverageEligibility)} / {safeText(catalog.priceApplicability)}</p>
    <ActorAudit label="Uploader" step={catalog.actors?.uploader} />
    <ActorAudit label="Validator" step={catalog.actors?.validator} />
    <ActorAudit label="Truster" step={catalog.actors?.truster} />
  </section>
}

export function sameStaff(userId: string | undefined, step: ActorStep | undefined) {
  return !!userId && step?.state === 'COMPLETED' && step.staffId === userId
}

export function proposalActionState(proposal: MappingProposal, userId: string | undefined) {
  const presentation = proposalPresentation(proposal)
  const catalog = catalogPresentation(proposal.catalog, proposal.catalog?.verificationScope ?? 'METADATA_ONLY')
  const proposed = presentation.verified && proposal.workflowStatus === 'PROPOSED' && proposal.evidenceScope === 'FULL_VERIFICATION'
  const approved = presentation.verified && proposal.workflowStatus === 'APPROVED' && proposal.evidenceScope === 'FULL_VERIFICATION'
    && catalog.newAuthorizationEvidence && proposal.catalogVerification === 'VERIFIED'
  return {
    presentation,
    canReject: proposed,
    canApprove: proposed && !sameStaff(userId, proposal.actors?.importer),
    canActivate: approved && !sameStaff(userId, proposal.actors?.importer) && !sameStaff(userId, proposal.actors?.approver),
    selfApproveBlocked: proposed && sameStaff(userId, proposal.actors?.importer),
    selfActivateBlocked: approved && (sameStaff(userId, proposal.actors?.importer) || sameStaff(userId, proposal.actors?.approver)),
  }
}
