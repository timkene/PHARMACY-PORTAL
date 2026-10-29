'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ingestSignedCatalog, listCatalogSnapshots, readSignedCatalog } from '@/lib/pa-api'
import { hasPaPermission, type PaPermission } from '@/lib/pa-permissions'
import { catalogPresentation } from '@/lib/pa-presentation'
import type { CatalogMetadata, CatalogMutationResult, CatalogPage } from '@/lib/pa-types'
import { StaffShell } from '../StaffShell'
import { BUTTON, CursorControls, INPUT, safeText } from './PreparationShared'
import { AdminError, outcomeUncertain, UUID_RE } from './PaAdminShared'

export function CatalogWorkspace({ userName, permissions }: { userName: string; permissions: readonly PaPermission[] }) {
  const canRead = hasPaPermission(permissions, 'PA_CATALOG_READ')
  const canIngest = hasPaPermission(permissions, 'PA_CATALOG_INGEST')
  const [page, setPage] = useState<CatalogPage>()
  const [created, setCreated] = useState<CatalogMutationResult>()
  const [bytes, setBytes] = useState<Uint8Array>()
  const [fileName, setFileName] = useState<string>()
  const [error, setError] = useState<unknown>()
  const [fileError, setFileError] = useState<string>()
  const [loading, setLoading] = useState(canRead)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [cursor, setCursor] = useState<string>()
  const [previous, setPrevious] = useState<(string | undefined)[]>([])
  const [lookup, setLookup] = useState('')
  const lock = useRef(false)

  const load = useCallback(async () => {
    if (!canRead) return
    setLoading(true); setError(undefined)
    try { setPage(await listCatalogSnapshots({ limit: 25, cursor })); setUncertain(false) }
    catch (cause) { setError(cause); setPage(undefined) }
    finally { setLoading(false) }
  }, [canRead, cursor])
  useEffect(() => { void load() }, [load])

  async function selectFile(file: File | undefined) {
    setBytes(undefined); setFileName(undefined); setFileError(undefined)
    if (!file) return
    try { setBytes(await readSignedCatalog(file)); setFileName(file.name) }
    catch { setFileError('The artifact must be non-empty, at most 16 MiB and valid UTF-8 JSON. It was not uploaded.') }
  }

  async function ingest() {
    if (!canIngest || !bytes || lock.current || uncertain) return
    lock.current = true; setBusy(true); setError(undefined)
    try { setCreated(await ingestSignedCatalog(bytes)) }
    catch (cause) {
      setError(cause)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { lock.current = false; setBusy(false) }
  }

  const id = lookup.trim()
  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">Procedure catalog</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">
      Upload an already signed catalog artifact. This client never signs, extracts or infers trust. Validation and trust are separate staff actions. Catalog evidence never establishes provider tariff, coverage or price eligibility.
    </p>
    {!canRead && !canIngest ? <p role="alert">PA_CATALOG_READ or PA_CATALOG_INGEST permission is required.</p> : <>
      {canIngest && <section aria-label="Ingest signed catalog" className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Ingest signed artifact</h2>
        <label className="flex flex-col">Signed JSON artifact
          <input type="file" accept="application/json,.json" disabled={busy} onChange={e => void selectFile(e.target.files?.[0])} />
        </label>
        {fileName && <p>Selected: {safeText(fileName)} ({bytes?.byteLength ?? 0} bytes, uploaded unchanged)</p>}
        {fileError && <p role="alert" className="text-error">{fileError}</p>}
        <button className={BUTTON} disabled={!bytes || busy || uncertain} onClick={() => void ingest()}>Upload signed catalog</button>
        {uncertain && <p role="status">Ingest outcome is unknown. Reload current snapshots before uploading again. No automatic retry was sent.</p>}
        {created && <section aria-label="Ingest receipt">
          <p>Snapshot: {safeText(created.snapshotId)} · Status: {safeText(created.status)}</p>
          <p>This mutation receipt is not verified GET metadata and does not grant trust.</p>
          {canRead && UUID_RE.test(created.snapshotId) && <Link href={`/staff/pa-catalog/${encodeURIComponent(created.snapshotId)}`}>Open ingested snapshot</Link>}
        </section>}
      </section>}
      {canRead && <>
        <form className="flex gap-3 items-end" onSubmit={event => event.preventDefault()}>
          <label className="flex flex-col">Open snapshot by ID<input className={INPUT} value={lookup} onChange={e => setLookup(e.target.value)} /></label>
          {UUID_RE.test(id) ? <Link className={BUTTON} href={`/staff/pa-catalog/${encodeURIComponent(id)}`}>Open snapshot</Link>
            : <button className={BUTTON} disabled>Open snapshot</button>}
        </form>
        {loading && <p role="status">Loading catalog metadata…</p>}
        {page && <section aria-label="Catalog snapshots" className="space-y-4">
          <p>List integrity scope: {safeText(page.integrityScope)}. Skipped invalid records: {page.skippedInvalidRecords}</p>
          {page.items.length === 0 && <p>No snapshots on this page.</p>}
          {page.items.map((item: CatalogMetadata, index) => {
            const shown = catalogPresentation(item, 'METADATA_ONLY')
            const key = item.snapshotId ?? `invalid-${index}`
            return <article key={key} className="border rounded p-4 space-y-1">
              <p className="font-mono">{safeText(item.snapshotId)}</p>
              <p>Recorded status: {safeText(item.status)}</p>
              <p>{shown.label}</p>
              {item.snapshotId && UUID_RE.test(item.snapshotId)
                ? <Link href={`/staff/pa-catalog/${encodeURIComponent(item.snapshotId)}`}>Open snapshot detail</Link>
                : <p>Snapshot identity unavailable.</p>}
            </article>
          })}
          <CursorControls disabled={loading} previous={previous.length > 0} next={page.nextCursor}
            onNext={() => { setPrevious([...previous, cursor]); setCursor(page.nextCursor ?? undefined) }}
            onPrevious={() => { setCursor(previous[previous.length - 1]); setPrevious(previous.slice(0, -1)) }} />
        </section>}
      </>}
      {error !== undefined && <AdminError error={error} unavailable="Catalog service unavailable." />}
    </>}
  </div></StaffShell>
}
