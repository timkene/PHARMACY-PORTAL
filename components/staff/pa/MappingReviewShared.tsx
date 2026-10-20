import { ApiError } from '@/lib/api'
import { CURSOR_EDITABLE_COLUMNS, MAX_CSV_BYTES } from '@/lib/pa-api'
import type { ReviewExport } from '@/lib/pa-types'

export type CreatedExport = Extract<ReviewExport, { exportId: string }>
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const EXPORT_LIMIT_MAX = 100
export const EXPORT_LIMIT_DEFAULT = 50
export const REVIEW_NOTICE = 'Imported rows become PROPOSED mappings only. Approval and activation are separate steps by other staff. No PA is submitted.'

const errorMessages: Record<string, string> = {
  EXPORT_EXPIRED: 'This export has expired (exports last 24 hours). Create a new export and edit the new file.',
  EXPORT_NOT_FOUND: 'The export was not found. Check the export ID.',
  PROTECTED_CELLS_CHANGED: 'Protected columns were changed. Only the three proposal columns may be edited; start again from the downloaded file.',
  PROTECTED_DIGEST_MISMATCH: 'Protected columns were changed. Only the three proposal columns may be edited; start again from the downloaded file.',
  EXPORT_ROW_SET_MISMATCH: 'Rows were added, removed or duplicated. Keep every exported row exactly once.',
  INVALID_CSV: 'The file is not a valid CSV in the exported format. Check the header, quoting and UTF-8 encoding.',
  UPLOAD_SIZE_INVALID: `The file is empty or larger than ${MAX_CSV_BYTES / 1024} KiB.`,
  INVALID_PROPOSED_CODE: 'A proposed MediCloud code is invalid. Use letters, digits, ".", "_", "/" or "-" only; PRE11 is reserved.',
  INVALID_PROPOSED_DESCRIPTION: 'A proposed description is invalid. It cannot start with =, +, - or @, or repeat the code.',
  DESCRIPTION_WITHOUT_PROPOSED_CODE: 'A proposed description was given without a proposed MediCloud code.',
  INVALID_MAPPING_NOTES: 'Mapping notes cannot start with =, +, - or @.',
  INVALID_REVIEW_TEXT: 'A proposal cell is too long or contains control characters such as tabs or line breaks.',
  CONFLICTING_NAMESPACE_PROPOSALS: 'Rows for the same source medication carry different proposals. Make them identical.',
  EXPORT_ALREADY_IMPORTED_DIFFERENT_CONTENT: 'This export was already imported with different content. Create a new export for further changes.',
  EXPORT_SCOPE_CHANGED: 'Preparation or mapping data changed after this export was created. Create a new export.',
  PREPARATION_STALE: 'Preparation data changed after this export was created. Recalculate if needed, then create a new export.',
  EXPORT_INTEGRITY_FAILURE: 'The stored export failed its integrity check. Create a new export.',
  EXPORT_NOT_OPEN: 'This export is no longer open for import. Check its import status.',
  EXPORT_IMPORT_CONFLICT: 'This export is no longer open for import. Check its import status.',
  EXPORT_TOO_LARGE: 'The export would exceed the file size limit. Use a smaller row limit.',
  ACTIVE_BATCH_REQUIRED: 'The batch is not open. Exports and imports need an open preparation batch.',
  BATCH_VERSION_CONFLICT: 'The batch changed. Use its current version and create the export again.',
  TRANSACTION_CONFLICT_REFRESH_REQUIRED: 'The result is unknown because of a concurrent change. Check the current state before trying again.',
}

export function reviewErrorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code && errorMessages[error.code]) return errorMessages[error.code]
    if (error.status === 401) return 'Your staff session has expired. Sign in again.'
    if (error.status === 403) return 'You do not have permission for this action.'
    if (error.status === 404) return 'The batch or export was not found.'
    if (error.status === 413) return `The file is larger than ${MAX_CSV_BYTES / 1024} KiB.`
    if (error.status === 415) return 'The file must be uploaded as UTF-8 CSV.'
    if (error.status >= 500) return 'Mapping review service unavailable. The result may be unknown; no automatic retry was sent.'
    if (error.status >= 400) return 'The request was rejected. Check the values and try again. No retry was sent.'
  }
  return 'Unable to reach the mapping review service. The result may be unknown; no automatic retry was sent.'
}

/** True when the request may have reached the server and changed state. */
export function outcomeUncertain(error: unknown) {
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408
    && error.code !== 'TRANSACTION_CONFLICT_REFRESH_REQUIRED')
}

export function expiryState(expiresAt: unknown, now = Date.now()): 'ACTIVE' | 'EXPIRED' | 'UNKNOWN' {
  const time = typeof expiresAt === 'string' ? Date.parse(expiresAt) : Number.NaN
  return Number.isNaN(time) ? 'UNKNOWN' : time <= now ? 'EXPIRED' : 'ACTIVE'
}

const skipLabels: Record<string, string> = {
  NOT_ACTIONABLE_MAPPING_REVIEW: 'Line does not need a mapping review',
  PREPARATION_STALE: 'Preparation is stale — recalculate first',
  PREPARATION_ROW_INVALID: 'Stored preparation row is invalid',
  MAPPING_VERSION_INVALID: 'Mapping version evidence is invalid',
  CSV_ROW_UNREPRESENTABLE: 'Row contains text that cannot be exported safely',
  CSV_SIZE_LIMIT_EXCEEDED: 'Row would exceed the file size limit',
}
export function skipReasonEntries(reasons: unknown) {
  if (!reasons || typeof reasons !== 'object') return []
  return Object.entries(reasons as Record<string, unknown>)
    .filter(([code, count]) => /^[A-Z][A-Z0-9_]{1,99}$/.test(code) && typeof count === 'number' && Number.isInteger(count) && count >= 0)
    .map(([code, count]) => ({ code, count: count as number, label: skipLabels[code] ?? 'Skipped' }))
}

export function ReviewError({ error }: { error: unknown }) {
  return <p role="alert" className="border border-error rounded p-3 text-error">{reviewErrorText(error)}</p>
}

export function EditableColumnsNotice() {
  return <section aria-label="Editable columns" className="border border-outline-variant rounded p-3 space-y-1">
    <p className="font-semibold">Only these three columns may be edited:</p>
    <ul className="list-disc pl-6">{CURSOR_EDITABLE_COLUMNS.map(column => <li key={column}><code>{column}</code></li>)}</ul>
    <p>Do not change, add, remove or reorder any other column or cell. Leave a row&apos;s proposal blank to keep it unresolved.</p>
  </section>
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
