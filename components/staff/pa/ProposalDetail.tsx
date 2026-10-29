'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { activateMappingProposal, approveMappingProposal, getMappingProposal, rejectMappingProposal } from '@/lib/pa-api'
import { hasPaPermission, type PaPermission } from '@/lib/pa-permissions'
import type { DecisionReceipt, MappingProposal } from '@/lib/pa-types'
import { StaffShell } from '../StaffShell'
import { BUTTON, INPUT, safeText } from './PreparationShared'
import { ConfirmDialog } from './ConfirmDialog'
import { ActorAudit, AdminError, CatalogAudit, newRequestId, outcomeUncertain, proposalActionState, reasonValid } from './PaAdminShared'

type ActionKind = 'reject' | 'approve' | 'activate'

export function ProposalDetail({ proposalId, userId, userName, permissions }: {
  proposalId: string; userId: string; userName: string; permissions: readonly PaPermission[]
}) {
  const canRead = hasPaPermission(permissions, 'PA_MAPPING_REVIEW')
  const canApprove = hasPaPermission(permissions, 'PA_MAPPING_APPROVE')
  const canActivate = hasPaPermission(permissions, 'PA_MAPPING_ACTIVATE')
  const [proposal, setProposal] = useState<MappingProposal>()
  const [receipt, setReceipt] = useState<DecisionReceipt>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(canRead)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [reason, setReason] = useState('')
  const [replaceActive, setReplaceActive] = useState(false)
  const [confirm, setConfirm] = useState<ActionKind>()
  const [requestId, setRequestId] = useState(newRequestId)
  const lock = useRef(false)

  const load = useCallback(async () => {
    if (!canRead) return
    setLoading(true); setError(undefined)
    try { setProposal(await getMappingProposal(proposalId)); setUncertain(false) }
    catch (cause) { setError(cause); setProposal(undefined) }
    finally { setLoading(false) }
  }, [canRead, proposalId])
  useEffect(() => { void load() }, [load])

  const state = proposal ? proposalActionState(proposal, userId) : undefined
  const allowed = !!proposal && !busy && !loading && !uncertain && reasonValid(reason)

  async function submit(kind: ActionKind) {
    if (!proposal || lock.current || !allowed) return
    if (kind === 'reject' && !(canRead && state?.canReject)) return
    if (kind === 'approve' && !(canApprove && state?.canApprove)) return
    if (kind === 'activate' && !(canActivate && state?.canActivate)) return
    lock.current = true; setBusy(true); setError(undefined)
    const body = {
      requestId, expectedHeadVersion: proposal.expectedHeadVersion,
      expectedActiveVersion: proposal.expectedActiveVersion, reason: reason.trim(),
      ...(kind === 'activate' ? { replaceActive } : {}),
    }
    try {
      const result = kind === 'reject' ? await rejectMappingProposal(proposalId, body)
        : kind === 'approve' ? await approveMappingProposal(proposalId, body)
          : await activateMappingProposal(proposalId, body)
      setReceipt(result); setConfirm(undefined); setRequestId(newRequestId())
      await load()
    } catch (cause) {
      setError(cause); setConfirm(undefined)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { lock.current = false; setBusy(false) }
  }

  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">Mapping proposal</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">
      Approval does not activate a mapping. Activation does not submit a PA. Independent staff must perform importer, approver and activator roles.
    </p>
    {!canRead ? <p role="alert">PA_MAPPING_REVIEW permission is required to open this proposal.</p> : <>
      {loading && <p role="status">Loading proposal evidence…</p>}
      {error !== undefined && <AdminError error={error} unavailable="Proposal service unavailable." />}
      {uncertain && <p role="status">The last action outcome is unknown. Reload current evidence before another action. No automatic retry was sent.</p>}
      <button className={BUTTON} disabled={busy} onClick={() => void load()}>Reload current evidence</button>
      {receipt && <section aria-label="Decision receipt" className="border rounded p-4">
        <p>Recorded result: {safeText(receipt.status)} · Lifecycle version: {receipt.lifecycleVersion}</p>
        <p>This receipt is not PA authorization.</p>
      </section>}
      {proposal && state && <section aria-label="Verified proposal" className="space-y-3 border rounded p-4">
        <p>{state.presentation.label}</p>
        <p>Source: {safeText(proposal.sourceCode)} · {safeText(proposal.sourceDescription)}</p>
        <p>Proposed: {safeText(proposal.proposedMedicloudCode)} · {safeText(proposal.proposedMedicloudDescription)}</p>
        <p>Canonical: {safeText(proposal.canonicalCode)} · {safeText(proposal.canonicalDescription)}</p>
        <p>Notes: {safeText(proposal.mappingNotes)}</p>
        <p>Expected head version: {proposal.expectedHeadVersion} · Expected active version: {proposal.expectedActiveVersion ?? 'None'}</p>
        <p>Three-person status: {safeText(proposal.threePersonStatus)}</p>
        <ActorAudit label="Importer" step={proposal.actors?.importer} />
        <ActorAudit label="Approver" step={proposal.actors?.approver} />
        <ActorAudit label="Activator" step={proposal.actors?.activator} />
        <CatalogAudit catalog={proposal.catalog} scope={proposal.catalog?.verificationScope ?? proposal.evidenceScope} />
        <label className="flex flex-col">Review reason
          <textarea className={INPUT} value={reason} maxLength={500} disabled={busy}
            onChange={e => setReason(e.target.value)} />
        </label>
        {proposal.expectedActiveVersion != null && <label className="flex gap-2 items-center">
          <input type="checkbox" checked={replaceActive} disabled={busy} onChange={e => setReplaceActive(e.target.checked)} />
          Replace the current ACTIVE mapping
        </label>}
        <div className="flex flex-wrap gap-3">
          <button className={BUTTON} disabled={!allowed || !canRead || !state.canReject}
            onClick={() => setConfirm('reject')}>Reject proposal</button>
          <button className={BUTTON} disabled={!allowed || !canApprove || !state.canApprove}
            onClick={() => setConfirm('approve')}>Approve proposal</button>
          <button className={BUTTON} disabled={!allowed || !canActivate || !state.canActivate}
            onClick={() => setConfirm('activate')}>Activate mapping</button>
        </div>
        {!canApprove && <p>PA_MAPPING_APPROVE is required to approve.</p>}
        {!canActivate && <p>PA_MAPPING_ACTIVATE is required to activate.</p>}
        {state.selfApproveBlocked && <p>The importer cannot approve this proposal.</p>}
        {state.selfActivateBlocked && <p>The importer or approver cannot activate this proposal.</p>}
        {!state.presentation.verified && <p>Workflow evidence is not verified, so actions stay disabled.</p>}
      </section>}
    </>}
    {confirm && <ConfirmDialog busy={busy} title={confirm === 'reject' ? 'Reject this proposal?' : confirm === 'approve' ? 'Approve this proposal?' : 'Activate this mapping?'}
      description={confirm === 'activate'
        ? 'Activation records an ACTIVE mapping only. It does not submit a PA or confirm price eligibility.'
        : 'This decision is recorded against the current expected versions. It does not submit a PA.'}
      confirmLabel={confirm === 'reject' ? 'Confirm rejection' : confirm === 'approve' ? 'Confirm approval' : 'Confirm activation'}
      onCancel={() => setConfirm(undefined)} onConfirm={() => void submit(confirm)} />}
  </div></StaffShell>
}
