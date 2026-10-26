'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCatalogSnapshot, trustCatalogSnapshot, validateCatalogSnapshot } from '@/lib/pa-api'
import { hasPaPermission, type PaPermission } from '@/lib/pa-permissions'
import { catalogPresentation } from '@/lib/pa-presentation'
import type { CatalogMetadata, CatalogMutationResult, CatalogValidationResult } from '@/lib/pa-types'
import { StaffShell } from '../StaffShell'
import { BUTTON } from './PreparationShared'
import { ConfirmDialog } from './ConfirmDialog'
import { AdminError, CatalogAudit, outcomeUncertain, sameStaff } from './PaAdminShared'

export function CatalogDetail({ snapshotId, userId, userName, permissions }: {
  snapshotId: string; userId: string; userName: string; permissions: readonly PaPermission[]
}) {
  const canRead = hasPaPermission(permissions, 'PA_CATALOG_READ')
  const canValidate = hasPaPermission(permissions, 'PA_CATALOG_VALIDATE')
  const canTrust = hasPaPermission(permissions, 'PA_CATALOG_TRUST')
  const [catalog, setCatalog] = useState<CatalogMetadata>()
  const [validation, setValidation] = useState<CatalogValidationResult>()
  const [trusted, setTrusted] = useState<CatalogMutationResult>()
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(canRead)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [confirm, setConfirm] = useState<'validate' | 'trust'>()
  const lock = useRef(false)

  const load = useCallback(async () => {
    if (!canRead) return
    setLoading(true); setError(undefined)
    try { setCatalog(await getCatalogSnapshot(snapshotId)); setUncertain(false) }
    catch (cause) { setError(cause); setCatalog(undefined) }
    finally { setLoading(false) }
  }, [canRead, snapshotId])
  useEffect(() => { void load() }, [load])

  const evidence = catalog ? catalogPresentation(catalog, 'FULL_VERIFICATION') : undefined
  const validateReady = !!catalog && canValidate && !sameStaff(userId, catalog.actors?.uploader)
  const trustReady = !!catalog && canTrust && !sameStaff(userId, catalog.actors?.uploader) && !sameStaff(userId, catalog.actors?.validator)

  async function run(kind: 'validate' | 'trust') {
    if (lock.current || busy || uncertain) return
    if (kind === 'validate' && !validateReady) return
    if (kind === 'trust' && !trustReady) return
    lock.current = true; setBusy(true); setError(undefined)
    try {
      if (kind === 'validate') setValidation(await validateCatalogSnapshot(snapshotId))
      else setTrusted(await trustCatalogSnapshot(snapshotId))
      setConfirm(undefined)
      if (canRead) await load()
    } catch (cause) {
      setError(cause); setConfirm(undefined)
      if (outcomeUncertain(cause)) setUncertain(true)
    } finally { lock.current = false; setBusy(false) }
  }

  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">Catalog snapshot</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">
      Uploader, validator and truster must be independent staff. Trust never authorizes a PA, tariff or price.
    </p>
    {!canRead ? <p role="alert">PA_CATALOG_READ permission is required to verify this snapshot.</p> : <>
      {loading && <p role="status">Loading catalog evidence…</p>}
      {error !== undefined && <AdminError error={error} unavailable="Catalog service unavailable." />}
      {uncertain && <p role="status">The last catalog action outcome is unknown. Reload current evidence before another action.</p>}
      <button className={BUTTON} disabled={busy} onClick={() => void load()}>Reload current evidence</button>
      {validation && <p>Validation evidence recorded: {validation.validationEvidenceId}. Status: {validation.status}</p>}
      {trusted && <p>Trust mutation status: {trusted.status}. This is not verified GET metadata.</p>}
      {catalog && evidence && <section aria-label="Verified catalog" className="border rounded p-4 space-y-3">
        <CatalogAudit catalog={catalog} scope="FULL_VERIFICATION" />
        <div className="flex gap-3">
          <button className={BUTTON} disabled={!validateReady || busy || uncertain} onClick={() => setConfirm('validate')}>Validate snapshot</button>
          <button className={BUTTON} disabled={!trustReady || busy || uncertain} onClick={() => setConfirm('trust')}>Trust snapshot</button>
        </div>
        {!canValidate && <p>PA_CATALOG_VALIDATE is required to validate.</p>}
        {!canTrust && <p>PA_CATALOG_TRUST is required to trust.</p>}
        {sameStaff(userId, catalog.actors?.uploader) && <p>The uploader cannot validate or trust this snapshot.</p>}
        {sameStaff(userId, catalog.actors?.validator) && <p>The validator cannot trust this snapshot.</p>}
      </section>}
    </>}
    {confirm && <ConfirmDialog busy={busy}
      title={confirm === 'validate' ? 'Validate this signed catalog?' : 'Trust this validated catalog?'}
      description={confirm === 'validate'
        ? 'Validation records server-controlled evidence only. It does not mark the snapshot trusted.'
        : 'Trust is a separate staff action. It does not submit a PA or establish price eligibility.'}
      confirmLabel={confirm === 'validate' ? 'Confirm validation' : 'Confirm trust'}
      onCancel={() => setConfirm(undefined)} onConfirm={() => void run(confirm)} />}
  </div></StaffShell>
}
