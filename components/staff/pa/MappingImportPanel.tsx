'use client'
import { useRef, useState } from 'react'
import { getMappingImportStatus, importMappingProposals, readMappingCsv, MAX_CSV_BYTES } from '@/lib/pa-api'
import type { ImportReceipt, ImportStatus } from '@/lib/pa-types'
import { BUTTON, INPUT, safeText, timeText } from './PreparationShared'
import { UUID_PATTERN, ReviewError, expiryState, outcomeUncertain, type CreatedExport } from './MappingReviewShared'

function Receipt({ receipt }: { receipt: ImportReceipt }) {
  return <section aria-label="Import receipt" className="space-y-1">
    <h3 className="font-semibold">Import receipt</h3>
    <p>Status: {safeText(receipt.status)} — proposals are PROPOSED only, not approved or active.</p>
    <p>Import ID: <span className="font-mono">{safeText(receipt.importId)}</span> · Imported: {timeText(receipt.importedAt)}</p>
    <p>Rows with a proposal: {receipt.proposedRows} · Rows left unresolved: {receipt.unresolvedRows} · Proposals created: {receipt.proposalCount}</p>
  </section>
}

export function MappingImportPanel({ latestExport }: { latestExport?: CreatedExport }) {
  const [exportId, setExportId] = useState('')
  const [bytes, setBytes] = useState<Uint8Array>()
  const [fileName, setFileName] = useState<string>()
  const [fileError, setFileError] = useState<string>()
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  const [uncertainFor, setUncertainFor] = useState<string>()
  const [receipt, setReceipt] = useState<ImportReceipt>()
  const [status, setStatus] = useState<ImportStatus>()
  const lock = useRef(false)
  const id = exportId.trim()
  const validId = UUID_PATTERN.test(id)
  const uncertain = uncertainFor === id
  const knownExport = latestExport && latestExport.exportId === id ? latestExport : undefined
  const expiry = knownExport ? expiryState(knownExport.expiresAt) : 'UNKNOWN'

  async function selectFile(file: File | undefined) {
    setBytes(undefined); setFileName(undefined); setFileError(undefined)
    if (!file) return
    try { setBytes(await readMappingCsv(file)); setFileName(file.name) }
    catch { setFileError(`The file must be non-empty, at most ${MAX_CSV_BYTES / 1024} KiB and valid UTF-8. It was not uploaded.`) }
  }

  async function upload() {
    if (!validId || !bytes || lock.current || uncertain) return
    lock.current = true; setBusy(true); setError(undefined); setStatus(undefined)
    try { setReceipt(await importMappingProposals(id, bytes)) }
    catch (cause) {
      setError(cause)
      if (outcomeUncertain(cause)) setUncertainFor(id)
    } finally { setBusy(false); lock.current = false }
  }

  async function checkStatus() {
    if (!validId || lock.current) return
    lock.current = true; setBusy(true); setError(undefined)
    try {
      const current = await getMappingImportStatus(id)
      setStatus(current)
      if (current.status !== 'NOT_IMPORTED') setReceipt(current as ImportReceipt)
      // The outcome is now known either way, so an explicit upload may proceed.
      if (uncertainFor === id) setUncertainFor(undefined)
    } catch (cause) { setError(cause) }
    finally { setBusy(false); lock.current = false }
  }

  return <section aria-label="Import edited mapping review" className="border border-outline-variant rounded p-4 space-y-4">
    <h2 className="text-title-md font-semibold">Import edited file</h2>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={event => { event.preventDefault(); void upload() }}>
      <label className="flex flex-col">Export ID<input className={INPUT} value={exportId} onChange={e => { setExportId(e.target.value); setReceipt(undefined); setStatus(undefined); setError(undefined) }} disabled={busy} /></label>
      {latestExport && latestExport.exportId !== id && <button type="button" className={BUTTON} disabled={busy} onClick={() => setExportId(latestExport.exportId)}>Use the export just created</button>}
      <label className="flex flex-col">Edited CSV file<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => void selectFile(e.target.files?.[0])} /></label>
      <button className={BUTTON} disabled={!validId || !bytes || busy || uncertain}>Upload edited CSV</button>
      <button type="button" className={BUTTON} disabled={!validId || busy} onClick={() => void checkStatus()}>Check import status</button>
    </form>
    {fileName && <p>Selected: {safeText(fileName)} ({bytes?.byteLength ?? 0} bytes, uploaded unchanged)</p>}
    {fileError && <p role="alert" className="text-error">{fileError}</p>}
    {knownExport && <p>Export expires: {timeText(knownExport.expiresAt)}</p>}
    {expiry === 'EXPIRED' && <p role="alert">This export has expired by this device&apos;s clock. Create a new export; the server makes the final decision.</p>}
    {busy && <p role="status">Working…</p>}
    {error !== undefined && <ReviewError error={error} />}
    {uncertain && <p role="status">The import outcome is unknown. Check the import status before uploading again. No automatic retry was sent.</p>}
    {status?.status === 'NOT_IMPORTED' && <p role="status">Not imported yet. You may upload the edited file.</p>}
    {receipt && <Receipt receipt={receipt} />}
  </section>
}
