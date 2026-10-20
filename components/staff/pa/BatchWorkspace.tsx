'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '@/lib/pa-api'
import { ApiError } from '@/lib/api'
import type { PreparationBatch, PreparationRow, LineFilters, LinePage } from '@/lib/pa-types'
import { BatchSummary, PreparationNotice, PreparationError, PreparationTable, CursorControls, BUTTON, INPUT, openBatch } from './PreparationShared'
import { Toast } from '@/components/shared/Toast'
import { CloseBatchDialog } from './CloseBatchDialog'

export const FILTER_ID_MAX_LENGTH = 100
export const FILTER_ERROR = 'The line filters were rejected. Check the IssuePa provider and aggregator IDs (100 characters maximum) and apply the filters again. Batch actions are still available.'
const filtersActive = (filters: LineFilters) =>
  [filters.status, filters.mappingStatus, filters.providerId, filters.aggregatorId, filters.stale].some(value => value !== undefined)
// Only a validation rejection of the line query itself; batch state is unaffected.
const filterRejected = (cause: unknown, filters: LineFilters) =>
  cause instanceof ApiError && (cause.status === 400 || cause.status === 422) && filtersActive(filters)
// Known ownership conflict: the backend aborts before writing, so this batch is unchanged.
const ownershipConflict = (cause: unknown) =>
  cause instanceof ApiError && cause.status === 409 && cause.code === 'ORDER_ALREADY_IN_ACTIVE_BATCH'

export function BatchWorkspace({ batchId, canRead, canWrite, initialBatch }: { batchId: string; canRead: boolean; canWrite: boolean; initialBatch?: PreparationBatch }) {
  const [batch, setBatch] = useState(initialBatch)
  const [page, setPage] = useState<LinePage>()
  const [result, setResult] = useState<PreparationRow[]>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(canRead)
  const [busy, setBusy] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [closing, setClosing] = useState(false)
  const [filterError, setFilterError] = useState(false)
  const [notice, setNotice] = useState<string>()
  const dismissNotice = useCallback(() => setNotice(undefined), [])
  const [filters, setFilters] = useState<LineFilters>({})
  const [draft, setDraft] = useState({ status: '', mappingStatus: '', providerId: '', aggregatorId: '', stale: '' })
  const [cursor, setCursor] = useState<string>()
  const [previous, setPrevious] = useState<(string | undefined)[]>([])
  const lock = useRef(false)
  const generation = useRef(0)
  const load = useCallback(async () => {
    if (!canRead) return
    const current = ++generation.current
    setLoading(true); setError(undefined); setFilterError(false); setPage(undefined)
    try {
      const [batchResult, linesResult] = await Promise.allSettled([api.getPreparationBatch(batchId),
        api.listPreparationLines(batchId, { ...filters, cursor, limit: 25 })])
      if (current !== generation.current) return
      if (batchResult.status === 'rejected') { setError(batchResult.reason); setNeedsReload(true); return }
      setBatch(batchResult.value)
      if (linesResult.status === 'rejected') {
        // The batch itself was refreshed successfully, so a rejected filter needs no reload pause.
        if (filterRejected(linesResult.reason, filters)) { setFilterError(true); setNeedsReload(false) }
        else { setError(linesResult.reason); setNeedsReload(true) }
        return
      }
      setPage(linesResult.value); setNeedsReload(false)
    } finally { if (current === generation.current) setLoading(false) }
  }, [batchId, canRead, filters, cursor])
  const invalidateRead = useCallback(() => { generation.current++ }, [])
  useEffect(() => { void load(); return invalidateRead }, [load, invalidateRead])
  const allowed = canWrite && !busy && !loading && !needsReload && openBatch(batch ?? null, batchId)
  async function mutate(action: 'prepare' | 'recalculate' | 'close', selected?: string) {
    if (!allowed || lock.current || !batch) return
    if (action !== 'close' && !/^[a-f\d]{24}$/i.test(selected ?? '')) return
    lock.current = true; setBusy(true); setError(undefined)
    try {
      const version = { expectedVersion: batch.version }
      if (action === 'close') { setBatch(await api.closePreparationBatch(batchId, version)); setClosing(false) }
      else {
        const response = action === 'prepare' ? await api.prepareOrder(batchId, selected!, version) : await api.recalculatePreparation(batchId, selected!, version)
        setBatch(response.batch); setResult(response.items)
      }
      setNotice(action === 'close' ? 'Batch closed. Order ownership released.' : 'Preparation calculation saved. No PA submitted.')
      if (canRead) await load()
    } catch (cause) {
      setError(cause); setClosing(false)
      if (!ownershipConflict(cause)) setNeedsReload(true)
    }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="space-y-6">
    <PreparationNotice />
    {notice && <Toast type="success" message={notice} onDismiss={dismissNotice} />}
    {loading && <p role="status">Loading preparation…</p>}
    {error !== undefined && <PreparationError error={error} canRead={canRead} />}
    {needsReload && <div role="status"><p>Actions are paused. Reload the current batch before another mutation. No request was automatically retried.</p>{canRead ? <button className={BUTTON} disabled={loading || busy} onClick={() => void load()}>Reload current batch</button> : <p>A staff member with READ permission must check the current batch before further work.</p>}</div>}
    {batch && <BatchSummary batch={batch} />}
    {canWrite && <section aria-label="Preparation actions" className="space-y-3">
      <form onSubmit={event => { event.preventDefault(); void mutate('prepare', orderId.trim()) }}>
        <label className="block">Order ID<input className={INPUT} value={orderId} onChange={event => setOrderId(event.target.value)} required pattern="[a-fA-F0-9]{24}" disabled={!allowed} /></label>
        <button className={BUTTON} disabled={!allowed || !/^[a-f\d]{24}$/i.test(orderId.trim())}>Prepare order</button>
      </form>
      <button className={BUTTON} disabled={!allowed} onClick={() => setClosing(true)}>Close batch</button>
      {busy && <p role="status">Saving preparation data…</p>}
    </section>}
    {result && <section aria-label="Mutation result"><h2 className="font-semibold">Latest mutation result</h2><PreparationTable rows={result} onRecalculate={canWrite ? id => void mutate('recalculate', id) : undefined} disabled={!allowed} /></section>}
    {canRead && <section aria-label="Preparation lines" className="space-y-3">
      <form onSubmit={event => { event.preventDefault(); setCursor(undefined); setPrevious([]); setFilters({ status: (draft.status || undefined) as LineFilters['status'], mappingStatus: (draft.mappingStatus || undefined) as LineFilters['mappingStatus'], providerId: draft.providerId.trim() || undefined, aggregatorId: draft.aggregatorId.trim() || undefined, stale: draft.stale === '' ? undefined : draft.stale === 'true' }) }}>
        <fieldset disabled={busy || loading} className="flex flex-wrap gap-3"><legend>Filter preparation lines</legend>
          <label>Status<select className={INPUT} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="">All statuses</option>{['READY','REVIEW_REQUIRED','BLOCKED'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Mapping status<select className={INPUT} value={draft.mappingStatus} onChange={e => setDraft({ ...draft, mappingStatus: e.target.value })}><option value="">All mapping states</option>{['ACTIVE','PROPOSED','VALIDATED','REJECTED','RETIRED','UNMAPPED'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>IssuePa provider ID<input className={INPUT} maxLength={FILTER_ID_MAX_LENGTH} value={draft.providerId} onChange={e => setDraft({ ...draft, providerId: e.target.value })} /></label>
          <label>Aggregator ID<input className={INPUT} maxLength={FILTER_ID_MAX_LENGTH} value={draft.aggregatorId} onChange={e => setDraft({ ...draft, aggregatorId: e.target.value })} /></label>
          <label>Revision freshness<select className={INPUT} value={draft.stale} onChange={e => setDraft({ ...draft, stale: e.target.value })}><option value="">All revisions</option><option value="false">Current</option><option value="true">Stale</option></select></label>
          <button className={BUTTON}>Apply filters</button>
        </fieldset>
      </form>
      {filterError && <p role="alert" className="border border-error rounded p-3 text-error">{FILTER_ERROR}</p>}
      {page && <>{page.items.length === 0 && <p>No preparation lines match on this page.</p>}<p>Page counts: {page.pageCounts.lines} lines; {page.pageCounts.stale} stale. Batch counts remain LAST_CALCULATION.</p><PreparationTable rows={page.items} onRecalculate={canWrite ? id => void mutate('recalculate', id) : undefined} disabled={!allowed} /><CursorControls disabled={busy || loading} previous={previous.length > 0} next={page.nextCursor} onNext={() => { setPrevious([...previous, cursor]); setCursor(page.nextCursor ?? undefined) }} onPrevious={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)) }} /></>}
    </section>}
    {closing && <CloseBatchDialog busy={busy} onCancel={() => setClosing(false)} onConfirm={() => void mutate('close')} />}
  </div>
}
