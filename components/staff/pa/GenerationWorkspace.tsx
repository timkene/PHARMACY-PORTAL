'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getOrder } from '@/lib/api'
import { generatePharmacyPa, markPaVerificationRequired, verifyPaLine } from '@/lib/pa-generation'
import type { PaPublicLine, PaPublicState, VerificationResolution } from '@/lib/pa-types'
import type { Order } from '@/lib/types'
import { StaffShell } from '../StaffShell'
import { BUTTON, INPUT, safeText } from './PreparationShared'
import { ConfirmDialog } from './ConfirmDialog'
import { AdminError, ORDER_ID_RE, outcomeUncertain } from './PaAdminShared'
import type { PaPermission } from '@/lib/pa-permissions'

const lineStates: Record<string, string> = {
  pending: 'Pending transmission',
  submitting: 'Transmission in progress',
  generated: 'Confirmed submitted',
  verification_required: 'Verification required',
  failed_rejected: 'Rejected — manual review required',
  failed_retryable: 'Authoritative absence recorded — controlled retry may be available',
  not_generated: 'Not submitted',
}

function asState(value: Order['paGeneration']): PaPublicState {
  if (!value || typeof value !== 'object') return { available: false, status: 'unavailable' }
  if (value.available !== true) return { available: false, status: typeof value.status === 'string' ? value.status : 'unavailable' }
  return {
    available: true,
    status: typeof value.status === 'string' ? value.status : 'unavailable',
    active: value.active === true,
    interrupted: value.interrupted === true,
    lines: Array.isArray(value.lines) ? value.lines.filter(line => line && typeof line.lineId === 'string') : [],
  }
}

function emptyVerify(resolution: VerificationResolution['resolution']): VerificationResolution {
  return { resolution, evidence: '', paNumber: '', confirmNoPaCreated: false, confirmAuthoritativeAbsence: false,
    reconciliationReference: '', verificationMethod: '', checkedWith: '', verifiedAt: '' }
}

export function GenerationWorkspace({ orderId, userName, permissions = [] }: {
  orderId: string; userName: string; permissions?: readonly PaPermission[]
}) {
  const validId = ORDER_ID_RE.test(orderId)
  const [order, setOrder] = useState<Order>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(validId)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [confirm, setConfirm] = useState<'generate' | 'interrupt'>()
  const [verifyLine, setVerifyLine] = useState<string>()
  const [verify, setVerify] = useState<VerificationResolution>(emptyVerify('existing_pa'))
  const lock = useRef(false)

  const load = useCallback(async () => {
    if (!validId) return
    setLoading(true); setError(undefined)
    try {
      const result = await getOrder(orderId)
      setOrder(result.order)
      setUncertain(false)
    } catch (cause) { setError(cause); setOrder(undefined) }
    finally { setLoading(false) }
  }, [orderId, validId])
  useEffect(() => { void load() }, [load])

  const state = asState(order?.paGeneration)
  const version = Number.isInteger(order?.version) ? order!.version! : undefined
  const completed = order?.status === 'completed'
  const blockedLine = state.available && state.lines.some(line =>
    ['verification_required', 'submitting', 'failed_rejected'].includes(line.status))
  const allGenerated = state.available && state.lines.length > 0 && state.lines.every(line => line.status === 'generated')
  const canGenerate = completed && version !== undefined && !state.active && !state.interrupted && !blockedLine && !allGenerated && !busy && !uncertain && !loading
  const canInterrupt = state.available && state.interrupted && !busy && !uncertain

  async function generate() {
    if (!canGenerate || lock.current || version === undefined) return
    lock.current = true; setBusy(true); setError(undefined)
    try {
      const result = await generatePharmacyPa(orderId, version)
      setOrder(current => current ? { ...current, paGeneration: { available: true, status: result.status, active: false, interrupted: false, lines: result.lines } } : current)
      setConfirm(undefined)
      await load()
    } catch (cause) {
      setError(cause); setConfirm(undefined)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { lock.current = false; setBusy(false) }
  }

  async function interrupt() {
    if (!canInterrupt || lock.current) return
    lock.current = true; setBusy(true); setError(undefined)
    try {
      await markPaVerificationRequired(orderId)
      setConfirm(undefined)
      await load()
    } catch (cause) {
      setError(cause); setConfirm(undefined)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { lock.current = false; setBusy(false) }
  }

  async function submitVerify() {
    if (!verifyLine || lock.current || busy || uncertain) return
    if (verify.evidence.trim().length < 10 || verify.evidence.trim().length > 2000) return
    lock.current = true; setBusy(true); setError(undefined)
    try {
      await verifyPaLine(orderId, verifyLine, verify)
      setVerifyLine(undefined)
      await load()
    } catch (cause) {
      setError(cause)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { lock.current = false; setBusy(false) }
  }

  function lineAction(line: PaPublicLine) {
    if (!['verification_required', 'failed_rejected'].includes(line.status)) return 'No recovery action on this line.'
    return <button className={BUTTON} disabled={busy || uncertain} onClick={() => { setVerifyLine(line.lineId); setVerify(emptyVerify('existing_pa')) }}>Record verification</button>
  }

  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">PA generation</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">
      Generation uses the current order version and one upstream IssuePa group. Uncertain results require explicit verification. This screen never retries automatically.
    </p>
    {!validId ? <p role="alert">Enter a valid order identifier.</p> : <>
      {loading && <p role="status">Loading order PA state…</p>}
      {error !== undefined && <AdminError error={error} unavailable="PA generation service unavailable." />}
      {uncertain && <p role="status">The last generation or recovery outcome is unknown. Reload the order before another action. No automatic retry was sent.</p>}
      <button className={BUTTON} disabled={busy} onClick={() => void load()}>Reload current order</button>
      {order && <section aria-label="Order PA state" className="border rounded p-4 space-y-3">
        <p>Order: <span className="font-mono">{safeText(order.id)}</span> · Status: {safeText(order.status)} · Version: {version ?? 'Unavailable'}</p>
        {!state.available ? <p>PA generation is unavailable on this order ({safeText(state.status)}).</p> : <>
          <p>Generation status: {safeText(state.status)}{state.active ? ' · in progress' : ''}{state.interrupted ? ' · interrupted claim expired' : ''}</p>
          <table className="w-full text-body-sm" aria-label="PA generation lines">
            <thead><tr>{['Line', 'Procedure', 'Amount', 'Status', 'PA number', 'Recovery'].map(label => <th key={label} className="text-left p-2">{label}</th>)}</tr></thead>
            <tbody>{state.lines.map(line => <tr key={line.lineId} className="border-t">
              <td className="p-2 font-mono">{safeText(line.lineId)}</td>
              <td className="p-2">{safeText(line.procedureCode)} · {safeText(line.description)}</td>
              <td className="p-2">{typeof line.amount === 'number' ? line.amount : 'Unavailable'}</td>
              <td className="p-2">{lineStates[line.status] ?? 'Unavailable — verification required'}{line.failureKind ? <p>{safeText(line.failureKind)}</p> : null}</td>
              <td className="p-2">{safeText(line.paNumber)}</td>
              <td className="p-2">{lineAction(line)}</td>
            </tr>)}</tbody>
          </table>
        </>}
        {!completed && <p>PA generation is available only after order completion.</p>}
        {allGenerated && <p>All recorded lines are already generated. Another submission is blocked.</p>}
        {blockedLine && <p>Uncertain or rejected lines block another submission until verification.</p>}
        <div className="flex gap-3">
          <button className={BUTTON} disabled={!canGenerate} onClick={() => setConfirm('generate')}>Generate PA</button>
          <button className={BUTTON} disabled={!canInterrupt} onClick={() => setConfirm('interrupt')}>Mark interrupted submission for verification</button>
        </div>
      </section>}
      {verifyLine && <section aria-label="Verification form" className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Verify line {verifyLine}</h2>
        <p>Verification records an authoritative outcome. It does not call IssuePa.</p>
        <label className="flex flex-col">Resolution
          <select className={INPUT} value={verify.resolution} onChange={e => setVerify(emptyVerify(e.target.value as VerificationResolution['resolution']))}>
            <option value="existing_pa">Existing PA reference</option>
            <option value="confirmed_rejected">Confirmed rejection</option>
            <option value="confirmed_no_pa">Confirmed authoritative absence</option>
          </select>
        </label>
        <label className="flex flex-col">Evidence<textarea className={INPUT} value={verify.evidence} onChange={e => setVerify({ ...verify, evidence: e.target.value })} /></label>
        {verify.resolution === 'existing_pa' && <label className="flex flex-col">Verified PA number<input className={INPUT} value={verify.paNumber ?? ''} onChange={e => setVerify({ ...verify, paNumber: e.target.value })} /></label>}
        {verify.resolution !== 'existing_pa' && <>
          <label className="flex flex-col">Verification method<input className={INPUT} value={verify.verificationMethod ?? ''} onChange={e => setVerify({ ...verify, verificationMethod: e.target.value })} /></label>
          <label className="flex flex-col">Checked with<input className={INPUT} value={verify.checkedWith ?? ''} onChange={e => setVerify({ ...verify, checkedWith: e.target.value })} /></label>
          <label className="flex flex-col">Verified at (timezone-aware ISO)
            <input className={INPUT} value={verify.verifiedAt ?? ''} onChange={e => setVerify({ ...verify, verifiedAt: e.target.value })} />
          </label>
          <p>Device clock is not used as authority. Enter the verified timestamp from the investigation record.</p>
        </>}
        {verify.resolution === 'confirmed_no_pa' && <>
          <label className="flex gap-2"><input type="checkbox" checked={verify.confirmNoPaCreated === true} onChange={e => setVerify({ ...verify, confirmNoPaCreated: e.target.checked })} />Confirm no PA was created</label>
          <label className="flex gap-2"><input type="checkbox" checked={verify.confirmAuthoritativeAbsence === true} onChange={e => setVerify({ ...verify, confirmAuthoritativeAbsence: e.target.checked })} />Confirm authoritative absence</label>
          <label className="flex flex-col">Reconciliation reference<input className={INPUT} value={verify.reconciliationReference ?? ''} onChange={e => setVerify({ ...verify, reconciliationReference: e.target.value })} /></label>
        </>}
        <button className={BUTTON} disabled={busy || verify.evidence.trim().length < 10} onClick={() => void submitVerify()}>Submit verification</button>
        <button className={BUTTON} disabled={busy} onClick={() => setVerifyLine(undefined)}>Cancel verification</button>
      </section>}
    </>}
    {confirm === 'generate' && <ConfirmDialog busy={busy} title="Generate PA for this order?"
      description="This sends one IssuePa group for currently eligible lines using the loaded expectedVersion. No automatic retry will be sent if the result is uncertain."
      confirmLabel="Confirm PA generation" onCancel={() => setConfirm(undefined)} onConfirm={() => void generate()} />}
    {confirm === 'interrupt' && <ConfirmDialog busy={busy} title="Mark interrupted submission for verification?"
      description="Recovery is allowlisted on the server. This does not submit a PA. Expired submitting lines become verification_required."
      confirmLabel="Confirm interruption recovery" onCancel={() => setConfirm(undefined)} onConfirm={() => void interrupt()} />}
  </div></StaffShell>
}

export function GenerationLookup({ userName, permissions = [] }: { userName: string; permissions?: readonly PaPermission[] }) {
  const [orderId, setOrderId] = useState('')
  const id = orderId.trim()
  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-4">
    <h1 className="text-title-lg font-semibold">PA generation</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">Open a completed order to generate or recover PA state. Mapping preparation is a separate workflow.</p>
    <label className="flex flex-col">Order ID<input className={INPUT} value={orderId} onChange={e => setOrderId(e.target.value)} /></label>
    {ORDER_ID_RE.test(id)
      ? <Link className={BUTTON} href={`/staff/pa-generation/${encodeURIComponent(id)}`}>Open PA generation</Link>
      : <button className={BUTTON} disabled>Open PA generation</button>}
  </div></StaffShell>
}
