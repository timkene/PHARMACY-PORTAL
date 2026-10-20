'use client'
import { useState } from 'react'
import { hasPaPermission, type PaPermission } from '@/lib/pa-permissions'
import { StaffShell } from '../StaffShell'
import { MappingExportPanel } from './MappingExportPanel'
import { MappingImportPanel } from './MappingImportPanel'
import { EditableColumnsNotice, REVIEW_NOTICE, type CreatedExport } from './MappingReviewShared'

export function MappingReviewWorkspace({ userName, permissions }: { userName: string; permissions: readonly PaPermission[] }) {
  const canExport = hasPaPermission(permissions, 'PA_MAPPING_EXPORT')
  const canImport = hasPaPermission(permissions, 'PA_MAPPING_IMPORT')
  const canReadBatches = hasPaPermission(permissions, 'PA_PREPARATION_READ')
  const [latestExport, setLatestExport] = useState<CreatedExport>()
  return <StaffShell userName={userName} permissions={permissions}><div className="p-6 space-y-6">
    <h1 className="text-title-lg font-semibold">Mapping Review Files</h1>
    <p className="border border-primary rounded p-3 font-semibold" role="note">{REVIEW_NOTICE}</p>
    {!canExport && !canImport ? <p role="alert">PA_MAPPING_EXPORT or PA_MAPPING_IMPORT permission is required.</p> : <>
      <EditableColumnsNotice />
      {canExport && <MappingExportPanel canReadBatches={canReadBatches} onExported={setLatestExport} />}
      {canImport && <MappingImportPanel latestExport={latestExport} />}
    </>}
  </div></StaffShell>
}
