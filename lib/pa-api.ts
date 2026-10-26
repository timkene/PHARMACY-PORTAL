/** Only the 21 reviewed PA administration/preparation routes. No transmission API. */
import { apiFetch, apiResponse } from './api'
import type { PreparationBatch, Page, BatchVersion, PrepareResult, LinePage, LineFilters, ExportRequest,
  ReviewExport, ImportReceipt, ImportStatus, MappingProposal, ProposalAction, ActivationAction, DecisionReceipt,
  CatalogPage, CatalogMetadata, CatalogMutationResult, CatalogValidationResult } from './pa-types'

export const MAX_CSV_BYTES = 512 * 1024
export const MAX_CATALOG_BYTES = 16 * 1024 * 1024
export const CURSOR_EDITABLE_COLUMNS = ['proposed_medicloud_code', 'proposed_medicloud_description', 'mapping_notes'] as const
const preparation = '/api/pa-preparation/batches'
const transfer = '/api/pa-mapping-review'
const proposals = '/api/pa-mapping-proposals'
const catalogs = '/api/pa-catalog/snapshots'
const id = (value: string) => encodeURIComponent(value)
const csrf = { 'X-Pharmacy-CSRF': '1' }
function query(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined) params.set(key, String(value))
  return params.size ? `?${params}` : ''
}
function post<T>(path: string, body: unknown) {
  // Browser supplies its own Origin. This header never overrides server Origin checks.
  return apiFetch<T>(path, { method: 'POST', headers: csrf, body: JSON.stringify(body), cache: 'no-store' })
}
const versionBody = (value: BatchVersion) => ({ expectedVersion: value.expectedVersion })
const actionBody = (value: ProposalAction) => ({ requestId: value.requestId, expectedHeadVersion: value.expectedHeadVersion,
  expectedActiveVersion: value.expectedActiveVersion, reason: value.reason })

export const createPreparationBatch = (businessDate: string) => post<PreparationBatch>(preparation, { businessDate })
export const listPreparationBatches = (params: { limit?: number; cursor?: string } = {}) =>
  apiFetch<Page<PreparationBatch>>(preparation + query({ limit: params.limit, cursor: params.cursor }), { cache: 'no-store' })
export const getPreparationBatch = (batchId: string) => apiFetch<PreparationBatch>(`${preparation}/${id(batchId)}`, { cache: 'no-store' })
export const listPreparationLines = (batchId: string, params: LineFilters = {}) => apiFetch<LinePage>(`${preparation}/${id(batchId)}/lines` + query({
  limit: params.limit, cursor: params.cursor, status: params.status, mappingStatus: params.mappingStatus,
  providerId: params.providerId, aggregatorId: params.aggregatorId, stale: params.stale,
}), { cache: 'no-store' })
export const prepareOrder = (batchId: string, orderId: string, body: BatchVersion) =>
  post<PrepareResult>(`${preparation}/${id(batchId)}/orders/${id(orderId)}/prepare`, versionBody(body))
export const recalculatePreparation = (batchId: string, orderId: string, body: BatchVersion) =>
  post<PrepareResult>(`${preparation}/${id(batchId)}/orders/${id(orderId)}/recalculate`, versionBody(body))
export const closePreparationBatch = (batchId: string, body: BatchVersion) => post<PreparationBatch>(`${preparation}/${id(batchId)}/close`, versionBody(body))
export const createMappingExport = (batchId: string, body: ExportRequest) => post<ReviewExport>(`${transfer}/batches/${id(batchId)}/exports`, {
  expectedVersion: body.expectedVersion, ...(body.after !== undefined ? { after: body.after } : {}), ...(body.limit !== undefined ? { limit: body.limit } : {}),
})
export async function downloadMappingCsv(exportId: string): Promise<Blob> {
  const response = await apiResponse(`${transfer}/exports/${id(exportId)}/download`, { cache: 'no-store' })
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/csv') throw new Error('Expected CSV download')
  const blob = await response.blob()
  if (blob.size > MAX_CSV_BYTES) throw new Error('CSV download exceeds size limit')
  return blob
}
function checkedBytes(bytes: Uint8Array, limit: number) {
  if (!bytes.byteLength || bytes.byteLength > limit) throw new Error('Upload size invalid')
  // Check UTF-8 without reserializing, stripping the BOM or changing protected cells.
  new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
export async function readMappingCsv(file: Blob): Promise<Uint8Array> {
  if (!file.size || file.size > MAX_CSV_BYTES) throw new Error('Upload size invalid')
  const bytes = new Uint8Array(await file.arrayBuffer())
  checkedBytes(bytes, MAX_CSV_BYTES)
  return bytes
}
export const importMappingProposals = (exportId: string, bytes: Uint8Array) => apiFetch<ImportReceipt>(`${transfer}/exports/${id(exportId)}/imports`, {
  method: 'POST', headers: { ...csrf, 'Content-Type': 'text/csv; charset=utf-8' }, body: checkedBytes(bytes, MAX_CSV_BYTES), cache: 'no-store',
})
export const getMappingImportStatus = (exportId: string) => apiFetch<ImportStatus>(`${transfer}/exports/${id(exportId)}/import-status`, { cache: 'no-store' })
export const listMappingProposals = (params: { limit?: number; after?: string } = {}) => apiFetch<Page<MappingProposal>>(
  proposals + query({ limit: params.limit, after: params.after }), { cache: 'no-store' })
export const getMappingProposal = (proposalId: string) => apiFetch<MappingProposal>(`${proposals}/${id(proposalId)}`, { cache: 'no-store' })
export const rejectMappingProposal = (proposalId: string, body: ProposalAction) => post<DecisionReceipt>(`${proposals}/${id(proposalId)}/reject`, actionBody(body))
export const approveMappingProposal = (proposalId: string, body: ProposalAction) => post<DecisionReceipt>(`${proposals}/${id(proposalId)}/approve`, actionBody(body))
export const activateMappingProposal = (proposalId: string, body: ActivationAction) => post<DecisionReceipt>(`${proposals}/${id(proposalId)}/activate`, {
  ...actionBody(body), ...(body.replaceActive !== undefined ? { replaceActive: body.replaceActive } : {}),
})
export const listCatalogSnapshots = (params: { limit?: number; cursor?: string } = {}) => apiFetch<CatalogPage>(
  catalogs + query({ limit: params.limit, cursor: params.cursor }), { cache: 'no-store' })
export const getCatalogSnapshot = (snapshotId: string) => apiFetch<CatalogMetadata>(`${catalogs}/${id(snapshotId)}`, { cache: 'no-store' })
/** Upload an already signed artifact; clients never construct trust or signing authority. */
export async function readSignedCatalog(file: Blob): Promise<Uint8Array> {
  if (!file.size || file.size > MAX_CATALOG_BYTES) throw new Error('Upload size invalid')
  const bytes = new Uint8Array(await file.arrayBuffer())
  checkedBytes(bytes, MAX_CATALOG_BYTES)
  return bytes
}
export const ingestSignedCatalog = (bytes: Uint8Array) => apiFetch<CatalogMutationResult>(catalogs, {
  method: 'POST', headers: { ...csrf, 'Content-Type': 'application/json' }, body: checkedBytes(bytes, MAX_CATALOG_BYTES), cache: 'no-store',
})
export const validateCatalogSnapshot = (snapshotId: string) => post<CatalogValidationResult>(`${catalogs}/${id(snapshotId)}/validate`, {})
export const trustCatalogSnapshot = (snapshotId: string) => post<CatalogMutationResult>(`${catalogs}/${id(snapshotId)}/trust`, {})
