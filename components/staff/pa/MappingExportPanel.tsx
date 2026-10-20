'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createMappingExport, downloadMappingCsv, listPreparationBatches } from '@/lib/pa-api'
import type { Page, PreparationBatch, ReviewExport } from '@/lib/pa-types'
import { BUTTON, INPUT, CursorControls, openBatch, safeText, timeText } from './PreparationShared'
import { EXPORT_LIMIT_DEFAULT, EXPORT_LIMIT_MAX, UUID_PATTERN, ReviewError, expiryState, outcomeUncertain,
  saveBlob, skipReasonEntries, type CreatedExport } from './MappingReviewShared'

function validRequest(batchId: string, version: string, after: string, limit: string) {
  const expectedVersion = Number(version)
  const size = Number(limit)
  return UUID_PATTERN.test(batchId) && /^\d+$/.test(version) && Number.isSafeInteger(expectedVersion)
    && (after === '' || UUID_PATTERN.test(after)) && /^\d+$/.test(limit) && size >= 1 && size <= EXPORT_LIMIT_MAX
}

function BatchPicker({ onSelect, disabled }: { onSelect: (batch: PreparationBatch) => void; disabled: boolean }) {
  const [page, setPage] = useState<Page<PreparationBatch>>()
  const [error, setError] = useState<unknown>()
  const [cursor, setCursor] = useState<string>()
  const [previous, setPrevious] = useState<(string | undefined)[]>([])
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    setError(undefined); setPage(undefined)
    try { const next = await listPreparationBatches({ limit: 25, cursor }); if (current === generation.current) setPage(next) }
    catch (cause) { if (current === generation.current) setError(cause) }
  }, [cursor])
  const invalidateRead = useCallback(() => { generation.current++ }, [])
  useEffect(() => { void load(); return invalidateRead }, [load, invalidateRead])
  const open = page?.items.filter(batch => openBatch(batch, batch.batchId)) ?? []
  return <section aria-label="Open preparation batches" className="space-y-2">
    <h3 className="font-semibold">Open preparation batches</h3>
    {error !== undefined && <ReviewError error={error} />}
    {!page && error === undefined && <p role="status">Loading batches…</p>}
    {page && open.length === 0 && <p>No open batches on this page.</p>}
    <ul className="space-y-1">{open.map(batch => <li key={batch.batchId}>
      <span className="font-mono">{safeText(batch.batchId)}</span> · {safeText(batch.businessDate)} · version {batch.version}{' '}
      <button className={BUTTON} disabled={disabled} onClick={() => onSelect(batch)}>Use batch {batch.batchId}</button>
    </li>)}</ul>
    {page && <CursorControls disabled={disabled} previous={previous.length > 0} next={page.nextCursor}
      onNext={() => { setPrevious([...previous, cursor]); setCursor(page.nextCursor ?? undefined) }}
      onPrevious={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)) }} />}
  </section>
}

export function MappingExportPanel({ canReadBatches, onExported }: { canReadBatches: boolean; onExported: (value: CreatedExport) => void }) {
  const [batchId, setBatchId] = useState('')
  const [version, setVersion] = useState('')
  const [after, setAfter] = useState('')
  const [limit, setLimit] = useState(String(EXPORT_LIMIT_DEFAULT))
  const [result, setResult] = useState<ReviewExport>()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<unknown>()
  const lock = useRef(false)
  const downloadLock = useRef(false)
  const values = { batchId: batchId.trim(), version: version.trim(), after: after.trim(), limit: limit.trim() }
  const valid = validRequest(values.batchId, values.version, values.after, values.limit)

  async function create() {
    if (!valid || lock.current || uncertain) return
    lock.current = true; setBusy(true); setError(undefined); setDownloadError(undefined)
    try {
      const created = await createMappingExport(values.batchId, { expectedVersion: Number(values.version),
        ...(values.after ? { after: values.after } : {}), limit: Number(values.limit) })
      setResult(created)
      if (created.exportId) onExported(created as CreatedExport)
    } catch (cause) {
      setError(cause)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { setBusy(false); lock.current = false }
  }

  async function download(exportId: string) {
    if (downloadLock.current) return
    downloadLock.current = true; setDownloading(true); setDownloadError(undefined)
    try { saveBlob(await downloadMappingCsv(exportId), `mapping-review-${exportId}.csv`) }
    catch (cause) { setDownloadError(cause) }
    finally { setDownloading(false); downloadLock.current = false }
  }

  const created = result && result.exportId ? result as CreatedExport : undefined
  const skips = skipReasonEntries(result?.skipReasons)
  const expiry = created ? expiryState(created.expiresAt) : 'UNKNOWN'
  return <section aria-label="Create mapping review export" className="border border-outline-variant rounded p-4 space-y-4">
    <h2 className="text-title-md font-semibold">Create export</h2>
    {canReadBatches ? <BatchPicker disabled={busy} onSelect={batch => { setBatchId(batch.batchId); setVersion(String(batch.version)); setAfter('') }} />
      : <p>Enter the batch ID and its current version provided by a staff member with preparation READ permission.</p>}
    <form className="flex flex-wrap gap-3 items-end" onSubmit={event => { event.preventDefault(); void create() }}>
      <label className="flex flex-col">Batch ID<input className={INPUT} value={batchId} onChange={e => setBatchId(e.target.value)} disabled={busy || uncertain} /></label>
      <label className="flex flex-col">Expected batch version<input className={INPUT} inputMode="numeric" value={version} onChange={e => setVersion(e.target.value)} disabled={busy || uncertain} /></label>
      <label className="flex flex-col">Continue after cursor (optional)<input className={INPUT} value={after} onChange={e => setAfter(e.target.value)} disabled={busy || uncertain} /></label>
      <label className="flex flex-col">Row limit (1–{EXPORT_LIMIT_MAX})<input className={INPUT} inputMode="numeric" value={limit} onChange={e => setLimit(e.target.value)} disabled={busy || uncertain} /></label>
      <button className={BUTTON} disabled={!valid || busy || uncertain}>Create export</button>
    </form>
    {busy && <p role="status">Creating export…</p>}
    {error !== undefined && <ReviewError error={error} />}
    {uncertain && <div role="status" className="space-y-2">
      <p>The export outcome is unknown. An unused export expires on its own. No automatic retry was sent.</p>
      <button className={BUTTON} onClick={() => { setUncertain(false); setError(undefined) }}>Allow a new export</button>
    </div>}
    {result && <section aria-label="Export result" className="space-y-2">
      <h3 className="font-semibold">Export result</h3>
      <p>Status: {safeText(result.status)} · Rows exported: {Number.isInteger(result.rowCount) ? result.rowCount : 'Unavailable'} · Rows skipped: {Number.isInteger(result.skippedRows) ? result.skippedRows : 'Unavailable'}</p>
      {skips.length > 0 && <ul aria-label="Skipped row reasons">{skips.map(skip => <li key={skip.code}>{skip.label}: {skip.count} <code>{skip.code}</code></li>)}</ul>}
      {!created && <p>{result.status === 'EMPTY_SCAN' ? 'No rows needing review in this scan window. Continue from the next cursor to scan further.' : 'No rows currently need a mapping review in this batch.'}</p>}
      {created && <>
        <p>Export ID: <span className="font-mono">{safeText(created.exportId)}</span></p>
        <p>Created: {timeText(created.createdAt)} · Expires: {timeText(created.expiresAt)}</p>
        {expiry === 'EXPIRED' && <p role="alert">This export has expired by this device&apos;s clock. Create a new export; the server makes the final decision.</p>}
        <button className={BUTTON} disabled={downloading} onClick={() => void download(created.exportId)}>Download CSV</button>
        {downloading && <p role="status">Downloading…</p>}
        {downloadError !== undefined && <ReviewError error={downloadError} />}
      </>}
      {result.nextCursor && <p>More lines remain after cursor <span className="font-mono">{safeText(result.nextCursor)}</span>.{' '}
        <button className={BUTTON} disabled={busy || uncertain} onClick={() => setAfter(result.nextCursor ?? '')}>Continue from next cursor</button></p>}
    </section>}
  </section>
}
