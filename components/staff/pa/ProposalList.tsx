'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { listMappingProposals } from '@/lib/pa-api'
import { hasPaPermission, type PaPermission } from '@/lib/pa-permissions'
import { proposalPresentation } from '@/lib/pa-presentation'
import type { MappingProposal, Page } from '@/lib/pa-types'
import { StaffShell } from '../StaffShell'
import { BUTTON, INPUT, CursorControls, safeText } from './PreparationShared'
import { AdminError, UUID_RE } from './PaAdminShared'

export function ProposalList({ userName, permissions }: { userName: string; permissions: readonly PaPermission[] }) {
  const canRead = hasPaPermission(permissions, 'PA_MAPPING_REVIEW')
  const [page, setPage] = useState<Page<MappingProposal>>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(canRead)
  const [cursor, setCursor] = useState<string>()
  const [previous, setPrevious] = useState<(string | undefined)[]>([])
  const [lookup, setLookup] = useState('')
  const load = useCallback(async () => {
    if (!canRead) return
    setLoading(true); setError(undefined)
    try { setPage(await listMappingProposals({ limit: 25, after: cursor })) }
    catch (cause) { setError(cause); setPage(undefined) }
    finally { setLoading(false) }
  }, [canRead, cursor])
  useEffect(() => { void load() }, [load])
  const id = lookup.trim()
  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">Mapping proposals</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">
      This list is metadata only. Open a proposal to verify workflow evidence. Approval, rejection and activation are separate staff actions. No PA is submitted.
    </p>
    {!canRead ? <p role="alert">PA_MAPPING_REVIEW permission is required.</p> : <>
      <form className="flex gap-3 items-end" onSubmit={event => event.preventDefault()}>
        <label className="flex flex-col">Open proposal by ID
          <input className={INPUT} value={lookup} onChange={e => setLookup(e.target.value)} />
        </label>
        {UUID_RE.test(id) ? <Link className={BUTTON} href={`/staff/pa-mapping-proposals/${encodeURIComponent(id)}`}>Open proposal</Link>
          : <button className={BUTTON} disabled>Open proposal</button>}
      </form>
      {loading && <p role="status">Loading proposals…</p>}
      {error !== undefined && <AdminError error={error} unavailable="Proposal listing is unavailable." />}
      {page && <section aria-label="Proposed mappings" className="space-y-4">
        {page.items.length === 0 && <p>No proposed mappings on this page.</p>}
        {page.items.map(item => {
          const shown = proposalPresentation(item)
          return <article key={item.proposalId} className="border rounded p-4 space-y-1">
            <p className="font-mono">{safeText(item.proposalId)}</p>
            <p>{safeText(item.sourceDescription)} → {safeText(item.proposedMedicloudCode)}</p>
            <p>{shown.label}</p>
            <Link href={`/staff/pa-mapping-proposals/${encodeURIComponent(item.proposalId)}`}>Open proposal detail</Link>
          </article>
        })}
        <CursorControls disabled={loading} previous={previous.length > 0} next={page.nextCursor}
          onNext={() => { setPrevious([...previous, cursor]); setCursor(page.nextCursor ?? undefined) }}
          onPrevious={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)) }} />
      </section>}
    </>}
  </div></StaffShell>
}
