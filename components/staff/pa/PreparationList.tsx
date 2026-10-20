'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api'
import { createPreparationBatch, listPreparationBatches } from '@/lib/pa-api'
import { hasPaPermission, type PaPermission } from '@/lib/pa-permissions'
import type { PreparationBatch, Page } from '@/lib/pa-types'
import { StaffShell } from '../StaffShell'
import { BatchWorkspace } from './BatchWorkspace'
import { PreparationNotice, PreparationError, BatchSummary, CursorControls, BUTTON, INPUT } from './PreparationShared'
export function PreparationList({ userName, permissions }: { userName: string; permissions: readonly PaPermission[] }) {
  const canRead = hasPaPermission(permissions, 'PA_PREPARATION_READ')
  const canWrite = hasPaPermission(permissions, 'PA_PREPARATION_WRITE')
  const [page, setPage] = useState<Page<PreparationBatch>>()
  const [created, setCreated] = useState<PreparationBatch>()
  const [date, setDate] = useState('')
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(canRead)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [cursor, setCursor] = useState<string>()
  const [previous, setPrevious] = useState<(string | undefined)[]>([])
  const lock = useRef(false)
  const generation = useRef(0)
  const load = useCallback(async () => {
    if (!canRead) return
    const current = ++generation.current; setLoading(true); setPage(undefined); setError(undefined)
    try { const next = await listPreparationBatches({ limit: 25, cursor }); if (current === generation.current) setPage(next) }
    catch (cause) { if (current === generation.current) setError(cause) }
    finally { if (current === generation.current) setLoading(false) }
  }, [canRead, cursor])
  const invalidateRead = useCallback(() => { generation.current++ }, [])
  useEffect(() => { void load(); return invalidateRead }, [load, invalidateRead])
  async function create() {
    if (!canWrite || lock.current || uncertain) return
    lock.current = true; setBusy(true); setError(undefined)
    try { setCreated(await createPreparationBatch(date)); if (canRead) await load() }
    catch (cause) {
      setError(cause)
      // A definite 4xx rejection created nothing, so retry stays available. Network
      // failures, 5xx and 408 may have reached the server: keep creation locked.
      if (!(cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 408)) setUncertain(true)
    }
    finally { setBusy(false); lock.current = false }
  }
  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">PA Preparation</h1><PreparationNotice />
    {!canRead && <p role="alert">READ permission is required to view batches. WRITE permission permits only your explicit mutations and their returned results.</p>}
    {error !== undefined && <PreparationError error={error} canRead={canRead} />}
    {canWrite && <form onSubmit={e => { e.preventDefault(); void create() }} className="space-y-2"><label>Business date<input aria-label="Business date" className={INPUT} type="date" required value={date} onChange={e => setDate(e.target.value)} disabled={busy || uncertain} /></label><button className={BUTTON} disabled={busy || uncertain || !date}>Create batch</button>{uncertain && <p role="status">Creation outcome needs review. Check existing batches before creating another; no automatic retry occurred.</p>}</form>}
    {created && <section aria-label="Created batch"><h2 className="font-semibold">Created batch</h2>{canRead ? <><BatchSummary batch={created} /><Link href={`/staff/pa-preparation/${encodeURIComponent(created.batchId)}`}>Open created batch</Link></> : <BatchWorkspace key={created.batchId} batchId={created.batchId} initialBatch={created} canRead={false} canWrite={canWrite} />}</section>}
    {loading && <p role="status">Loading batches…</p>}
    {canRead && page && <section aria-label="Batches" className="space-y-4">{page.items.length === 0 && <p>No batches on this page.</p>}{page.items.map(batch => <article key={batch.batchId} className="border rounded p-4"><BatchSummary batch={batch} /><Link href={`/staff/pa-preparation/${encodeURIComponent(batch.batchId)}`}>Open batch {batch.batchId}</Link></article>)}<CursorControls disabled={loading || busy} previous={previous.length > 0} next={page.nextCursor} onNext={() => { setPrevious([...previous, cursor]); setCursor(page.nextCursor ?? undefined) }} onPrevious={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)) }} /></section>}
    {canRead && error !== undefined && <button className={BUTTON} disabled={loading || busy} onClick={() => void load()}>Reload batches</button>}
  </div></StaffShell>
}
