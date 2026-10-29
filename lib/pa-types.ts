/** Wire contracts from pharmacy-portal-api c0c8540. Strings retain server decimals/times. */
export type PreparationStatus = 'READY' | 'REVIEW_REQUIRED' | 'BLOCKED'
export type MappingStatus = 'ACTIVE' | 'PROPOSED' | 'VALIDATED' | 'REJECTED' | 'RETIRED' | 'UNMAPPED'
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface BatchCounts {
  orders: number; lines: number; ready: number; reviewRequired: number; blocked: number
  submitted: number | null; verificationRequired: number | null; stale: number | null
}
export interface PreparationBatch {
  batchId: string; businessDate: string; status: 'OPEN' | 'AUDITING' | 'CLOSED'; version: number
  createdAt: string; counts: BatchCounts; countsScope: 'LAST_CALCULATION'; countsAsOf: string | null
}
export interface PreparationLine {
  batchId: string; preparationLineId: string; preparationRevision: number; orderId: string; orderLineId: string
  calculatedAt: string
  provider: { referringProviderId: string | null; referringProviderDisplay: string | null
    aggregatorId: string | null; aggregatorDisplay: string | null; issuePaProviderId: string | null }
  medication: { sourceCode: string | null; sourceDescription: string; quantity: number | null; dosage: string | null }
  pricing: { approvedLineAmount: string | null; currency: 'NGN'; priceSource: 'finalProcedurePrices' | 'approvedProcedurePrices' | 'deliveryFee' }
  mapping: { sourceNamespaceId: string | null; mappingStatus: MappingStatus
    mappedMediCloudCode: string | null; mappedMediCloudDescription: string | null }
  validation: { member: 'VALID' | 'INVALID' | 'UNAVAILABLE'; memberFreshAsOf: string | null; memberFreshUntil: string | null
    price: 'VALID' | 'INVALID'; provider: 'VALID' | 'INVALID'; mapping: 'VALID' | 'REVIEW_REQUIRED' }
  preparationStatus: PreparationStatus; reasonCodes: string[]; isStale: boolean; submissionEligible: boolean
  transmission: { state: 'pending' | 'submitting' | 'generated' | 'verification_required' | 'failed_rejected' | 'failed_retryable' | 'not_generated' | 'UNKNOWN'
    verificationRequired: boolean; confirmedPaReference: string | null }
}
/** Fail-closed placeholder returned when one stored row cannot be projected. */
export interface InvalidPreparationLine {
  batchId: string; preparationLineId: string | null; orderId: string | null
  preparationStatus: 'BLOCKED'; reasonCodes: string[]; isStale: true; submissionEligible: false
  provider: Record<string, never>; medication: Record<string, never>; pricing: Record<string, never>
  mapping: { mappingStatus: 'UNMAPPED'; mappedMediCloudCode: null; mappedMediCloudDescription: null }
  validation: { member: 'UNAVAILABLE' }
  transmission: { state: 'UNKNOWN'; verificationRequired: true; confirmedPaReference: null }
}
export type PreparationRow = PreparationLine | InvalidPreparationLine
export interface LinePage extends Page<PreparationRow> {
  counts: BatchCounts; countsScope: 'LAST_CALCULATION'; countsAsOf: string | null
  pageCounts: { lines: number; stale: number; submitted: number; verificationRequired: number }
}
export interface LineFilters { limit?: number; cursor?: string; status?: PreparationStatus; mappingStatus?: MappingStatus
  providerId?: string; aggregatorId?: string; stale?: boolean }
export interface BatchVersion { expectedVersion: number }
export interface PrepareResult { batch: PreparationBatch; items: PreparationRow[] }
export interface ExportRequest extends BatchVersion { after?: string; limit?: number }
interface ExportBase { batchId: string; rowCount: number; nextCursor: string | null; skippedRows: number; skipReasons: Record<string, number> }
export type ReviewExport = ExportBase & ({ exportId: string; status: 'OPEN' | 'IMPORTED'; createdAt: string; expiresAt: string; contentDigest: string }
  | { exportId: null; status: 'EMPTY' | 'EMPTY_SCAN' })
export interface ImportReceipt { importId: string; exportId: string; status: 'PROPOSED_ONLY'; importedAt: string
  proposedRows: number; unresolvedRows: number; proposalCount: number }
export type ImportStatus = ImportReceipt | { exportId: string; status: 'NOT_IMPORTED' }
export interface ActorStep { state: 'PENDING' | 'COMPLETED' | 'INVALID'; staffId: string | null; at: string | null }
export type CatalogStatus = 'INGESTING' | 'VALIDATED' | 'TRUSTED' | 'INVALID' | 'MISSING'
export interface CatalogMetadata {
  snapshotId: string | null; status: CatalogStatus; source: 'MEDICLOUD_PROCEDUREDATA' | null
  sourceExtractedAt: string | null; importedAt: string | null; validatedAt: string | null; trustedAt: string | null
  revokedAt: string | null; recordCount: number | null; schemaVersion: 1 | null; revoked: boolean
  integrityStatus: 'NOT_EVALUATED' | 'VERIFIED' | 'INVALID' | 'UNAVAILABLE'
  trustStatus: 'UNTRUSTED' | 'NOT_EVALUATED' | 'TRUSTED' | 'REVOKED' | 'INVALID' | 'UNAVAILABLE'
  actors: { uploader: ActorStep; validator: ActorStep; truster: ActorStep }
  freshness: { evaluatedAt: string; expiresAt: string | null; maximumAgeHours: 24; state: 'FRESH' | 'EXPIRED' | 'FUTURE' | 'UNKNOWN' }
  usableForNewAuthorization: boolean; usableForExistingResolution: boolean
  providerTariffEligibility: 'NOT_VERIFIED'; coverageEligibility: 'NOT_VERIFIED'; priceApplicability: 'NOT_VERIFIED'
}
export interface CatalogPage extends Page<CatalogMetadata> { skippedInvalidRecords: number; integrityScope: 'METADATA_ONLY' }
export type ProposalCatalog = Omit<CatalogMetadata, 'status'> & {
  status: CatalogStatus | 'NOT_EVALUATED'; recordedStatus?: CatalogStatus
  binding: 'APPROVAL_BOUND' | 'LATEST_TRUSTED'; verificationScope: 'METADATA_ONLY' | 'FULL_VERIFICATION'
}
export interface MappingProposal {
  proposalId: string; mappingId: string; version: number; sourceNamespaceId: string
  sourceIdentityType: 'CODE' | 'DESCRIPTION'; sourceIdentityKey: string; sourceCode: string | null; sourceDescription: string
  proposedMedicloudCode: string; proposedMedicloudDescription: string | null; mappingNotes: string; provenance: 'CURSOR_PROPOSAL'
  workflowStatus: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'REPLACED' | 'UNVERIFIED'
  recordedWorkflowStatus: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'REPLACED' | 'UNKNOWN'
  workflowVerification: 'NOT_EVALUATED' | 'VERIFIED' | 'INVALID'; evidenceScope: 'METADATA_ONLY' | 'FULL_VERIFICATION'
  expectedHeadVersion: number; expectedActiveVersion: number | null
  actors: { importer: ActorStep; approver: ActorStep; activator: ActorStep }
  decision: ActorStep & { outcome: 'APPROVED' | 'REJECTED' | null }; threePersonStatus: 'PENDING' | 'VALID' | 'INVALID'
  catalog: ProposalCatalog
  catalogVerification: 'NOT_EVALUATED' | 'VERIFIED' | 'VERIFIED_FOR_EXISTING_ACTIVE' | 'UNAVAILABLE_OR_INVALID'
  catalogVerificationPurpose: 'METADATA_ONLY' | 'NEW_AUTHORIZATION' | 'EXISTING_ACTIVE_RESOLUTION' | 'UNAVAILABLE'
  canonicalCode: string | null; canonicalDescription: string | null
  providerTariffEligibility: 'NOT_VERIFIED'; priceApplicability: 'NOT_VERIFIED'
}
export interface ProposalAction { requestId: string; expectedHeadVersion: number; expectedActiveVersion: number | null; reason: string }
export interface ActivationAction extends ProposalAction { replaceActive?: boolean }
export interface DecisionReceipt {
  proposalId: string; mappingId: string; status: 'APPROVED' | 'REJECTED' | 'ACTIVATED'; lifecycleVersion: number
  decidedAt: string | null; activatedAt: string | null; snapshotId: string | null
}
/** Mutation summary is deliberately smaller than verified GET catalog metadata. */
export interface CatalogMutationResult {
  snapshotId: string; source: 'MEDICLOUD_PROCEDUREDATA'; sourceExtractedAt: string; importedAt: string
  recordCount: number; status: 'VALIDATED' | 'TRUSTED' | 'INVALID'; schemaVersion: 1
  providerTariffEligibility: 'NOT_VERIFIED'; priceApplicability: 'NOT_VERIFIED'
}
export interface CatalogValidationResult { snapshotId: string; validationEvidenceId: string; status: 'EVIDENCE_VALIDATED' }

/** Public staff PA ledger from GET /api/orders/{id} and generation/recovery POSTs. */
export interface PaPublicLine {
  lineId: string; procedureCode?: string | null; description?: string | null
  quantity?: number | null; amount?: number | null; status: string
  paNumber: string | null; failureKind?: string | null
}
export type PaPublicState =
  | { available: false; status: string; active?: never; interrupted?: never; lines?: never }
  | { available: true; status: string; active: boolean; interrupted: boolean; lines: PaPublicLine[] }
export interface PaGenerationResult { status: string; lines: PaPublicLine[] }
export interface PaVerifyResult { status: string; line: PaPublicLine }
export interface VerificationResolution {
  resolution: 'existing_pa' | 'confirmed_no_pa' | 'confirmed_rejected'
  evidence: string
  paNumber?: string | null
  confirmNoPaCreated?: boolean
  confirmAuthoritativeAbsence?: boolean
  reconciliationReference?: string | null
  verificationMethod?: string | null
  checkedWith?: string | null
  verifiedAt?: string | null
}
