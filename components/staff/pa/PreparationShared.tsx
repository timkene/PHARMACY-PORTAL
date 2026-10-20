import Link from 'next/link'
import { ApiError } from '@/lib/api'
import { StatusChip } from '@/components/shared/StatusChip'
import type { PreparationBatch, PreparationRow } from '@/lib/pa-types'

export const PA_NOTICE = 'Prepared data only — no PA submitted or authorized.'
export const BUTTON = 'rounded bg-primary px-4 py-2 text-on-primary disabled:opacity-40 disabled:cursor-not-allowed'
export const INPUT = 'border border-outline-variant rounded px-3 py-2 bg-surface-lowest'
export const safeText = (value: unknown) => typeof value === 'string' && value.trim() ? value.slice(0, 1000) : 'Unavailable'
export function timeText(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : 'Unavailable'
}
export function openBatch(batch: PreparationBatch | null, batchId: string) {
  return !!batch && batch.batchId === batchId && Number.isInteger(batch.version) && batch.version >= 0
    && (batch.status === 'OPEN' || batch.status === 'AUDITING')
}
export function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your staff session has expired. Sign in again.'
    if (error.status === 403) return 'You do not have permission for this action.'
    if (error.status === 404) return 'The batch or order was not found.'
    if (error.code === 'ORDER_ALREADY_IN_ACTIVE_BATCH') return 'This order belongs to another active preparation batch. It has not been moved.'
    if (error.status === 409) return 'The batch or order changed, or is no longer available for this action. Reload current data before another action. No retry was sent.'
    if (error.status === 422 || error.status === 400) return 'Check the selected date or order identifier. No retry was sent.'
    if (error.status >= 500) return 'Preparation service unavailable. The result may be unknown; no automatic retry was sent.'
  }
  return 'Unable to reach the preparation service. The result may be unknown; no automatic retry was sent.'
}
export function PreparationNotice() {
  return <p className="border border-primary rounded p-3 font-semibold" role="note">{PA_NOTICE}</p>
}
export function PreparationError({ error, canRead }: { error: unknown; canRead: boolean }) {
  return <div role="alert" className="border border-error rounded p-3 text-error">
    <p>{errorText(error)}</p>
    {canRead && error instanceof ApiError && error.code === 'ORDER_ALREADY_IN_ACTIVE_BATCH'
      && error.owningBatchId && /^[a-f0-9-]{36}$/.test(error.owningBatchId) ?
      <Link className="underline" href={`/staff/pa-preparation/${error.owningBatchId}`}>View owning batch</Link> : null}
  </div>
}
export function BatchSummary({ batch }: { batch: PreparationBatch }) {
  const names = ['orders', 'lines', 'ready', 'reviewRequired', 'blocked', 'submitted', 'verificationRequired', 'stale'] as const
  return <section aria-label="Batch summary" className="border border-outline-variant rounded p-4 space-y-3">
    <p>Batch: <span className="font-mono">{safeText(batch.batchId)}</span></p>
    <p>Business date: {safeText(batch.businessDate)} · Status: {safeText(batch.status)} · Version: {Number.isInteger(batch.version) ? batch.version : 'Unavailable'}</p>
    <p>LAST_CALCULATION — historical totals, not live eligibility. Last calculation: {timeText(batch.countsAsOf)}</p>
    <dl className="flex gap-5 flex-wrap">{names.map(name => {
      const value = batch.counts?.[name]
      return <div key={name}><dt>{name}</dt><dd>{typeof value === 'number' && Number.isFinite(value) ? value : 'Unavailable'}</dd></div>
    })}</dl>
    {batch.status === 'CLOSED' ? <p>Closed — order ownership released. Preparation controls are disabled.</p> : null}
  </section>
}
const reasonLabels: Record<string, string> = {
  MEMBER_VALIDATION_UNAVAILABLE: 'Member validation is unavailable. Preparation is blocked.',
  MEMBER_EVIDENCE_INVALID_OR_STALE: 'Current member evidence is invalid or stale.',
  SOURCE_NAMESPACE_OR_IDENTITY_REQUIRED: 'Source namespace or medication identity needs review.',
  MAPPING_CATALOG_EVIDENCE_INVALID: 'Trusted mapping catalog evidence is unavailable or invalid.',
  ACTIVE_MAPPING_REQUIRED: 'An active medication mapping is required.',
  SOURCE_DESCRIPTION_CHANGED: 'Source medication description changed. Review the mapping.',
  MAPPING_REQUIRED: 'Medication mapping needs review.',
  APPROVED_PRICE_EVIDENCE_INVALID: 'Approved line amount evidence is unavailable or invalid.',
  ISSUEPA_PROVIDER_UNCONFIGURED: 'The IssuePa provider identity is not configured.',
  PREPARATION_STALE: 'Source data changed. Recalculate preparation.',
  PREPARATION_ROW_INVALID: 'Stored preparation row is invalid. Review or recalculate it.',
  PA_LEDGER_INVALID: 'Transmission evidence requires controlled review.',
}
export function PreparationTable({ rows, onRecalculate, disabled = false }: {
  rows: PreparationRow[]; onRecalculate?: (orderId: string) => void; disabled?: boolean
}) {
  return <div className="overflow-x-auto"><table className="w-full text-body-sm" aria-label="PA preparation lines">
    <thead><tr>{['Identifiers / calculation', 'Provider context', 'Source medication / quantity', 'Approved line amount', 'Mapping / canonical target', 'Preparation / reasons', 'Transmission (read only)', 'Action'].map(label => <th scope="col" className="text-left p-3 border-b" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((raw, index) => {
      const row = (raw && typeof raw === 'object' ? raw : {}) as PreparationRow
      const complete = 'orderLineId' in row && 'preparationRevision' in row && 'calculatedAt' in row
        && !!row.provider && !!row.medication && !!row.pricing && !!row.mapping && !!row.validation && !!row.transmission
      const known = ['READY', 'REVIEW_REQUIRED', 'BLOCKED'].includes(row.preparationStatus)
      const status = !complete || !known ? 'BLOCKED' : row.isStale && row.preparationStatus === 'READY' ? 'REVIEW_REQUIRED' : row.preparationStatus
      const reasons = Array.isArray(row.reasonCodes) ? row.reasonCodes.filter(code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,99}$/.test(code)).slice(0, 30) : []
      if ((!complete || !known) && !reasons.includes('PREPARATION_ROW_INVALID')) reasons.push('PREPARATION_ROW_INVALID')
      const transmission = row.transmission
      const states: Record<string, string> = { pending: 'Pending transmission', submitting: 'Transmission in progress', generated: 'Confirmed submitted',
        verification_required: 'Verification required', failed_rejected: 'Rejected transmission', failed_retryable: 'Failed transmission — controlled review required', not_generated: 'Not submitted', UNKNOWN: 'Unknown — verification required' }
      return <tr key={typeof row.preparationLineId === 'string' ? row.preparationLineId : `invalid-${index}`} className="align-top border-b">
        <td className="p-3">Order: {safeText(row.orderId)}<br />Line: {complete ? safeText(row.orderLineId) : 'Unavailable'}<br />Preparation: {safeText(row.preparationLineId)}
          <br />Revision: {complete && Number.isInteger(row.preparationRevision) ? row.preparationRevision : 'Unavailable'}
          <br />Calculated: {complete ? timeText(row.calculatedAt) : 'Unavailable'}{row.isStale ? <p>Stale preparation</p> : null}</td>
        <td className="p-3">Referring provider: {safeText(row.provider?.referringProviderId)}<br />{row.provider?.referringProviderDisplay ? safeText(row.provider.referringProviderDisplay) : null}
          <br />Aggregator: {safeText(row.provider?.aggregatorId)}<br />{row.provider?.aggregatorDisplay ? safeText(row.provider.aggregatorDisplay) : null}
          <br />IssuePa provider: {safeText(row.provider?.issuePaProviderId)}</td>
        <td className="p-3">{safeText(row.medication?.sourceCode)}<br />{safeText(row.medication?.sourceDescription)}<br />Quantity: {typeof row.medication?.quantity === 'number' && Number.isFinite(row.medication.quantity) ? row.medication.quantity : 'Unavailable'}
          {row.medication?.dosage ? <p>Dosage: {safeText(row.medication.dosage)}</p> : null}</td>
        <td className="p-3">{row.pricing?.approvedLineAmount && row.pricing?.currency === 'NGN' ? `NGN ${safeText(row.pricing.approvedLineAmount)}` : 'Unavailable'}<br />Source: {safeText(row.pricing?.priceSource)}<br />Line total; no quantity multiplication</td>
        <td className="p-3">{safeText(row.mapping?.mappingStatus)}<br />{safeText(row.mapping?.mappedMediCloudCode)}<br />{safeText(row.mapping?.mappedMediCloudDescription)}</td>
        <td className="p-3"><StatusChip status={status === 'READY' ? 'active' : status === 'BLOCKED' ? 'error' : 'pending'} label={status} />
          <p>Member: {safeText(row.validation?.member)} · Price: {safeText(row.validation && 'price' in row.validation ? row.validation.price : undefined)}</p>
          <ul>{reasons.map(code => <li key={code}>{reasonLabels[code] ?? 'Review this validation result.'} <code>{code}</code></li>)}</ul></td>
        <td className="p-3">{states[transmission?.state] ?? states.UNKNOWN}{transmission?.verificationRequired ? <p>Verification required — no action available here.</p> : null}</td>
        <td className="p-3">{onRecalculate && typeof row.orderId === 'string' && /^[a-f0-9]{24}$/i.test(row.orderId) ?
          <button className={BUTTON} disabled={disabled} onClick={() => onRecalculate(row.orderId!)}>Recalculate order {row.orderId}</button> : '—'}</td>
      </tr>
    })}</tbody>
  </table></div>
}
export function CursorControls({ next, previous, disabled, onNext, onPrevious }: {
  next: string | null; previous: boolean; disabled: boolean; onNext: () => void; onPrevious: () => void
}) {
  return <nav aria-label="Result pages" className="flex gap-3">
    <button className={BUTTON} disabled={disabled || !previous} onClick={onPrevious}>Previous page</button>
    <button className={BUTTON} disabled={disabled || !next} onClick={onNext}>Next page</button>
  </nav>
}
