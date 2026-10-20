import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { hasPaPermission } from '@/lib/pa-permissions'
import { StaffShell } from '@/components/staff/StaffShell'
import { BatchWorkspace } from '@/components/staff/pa/BatchWorkspace'
export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  const permissions = staff.permissions ?? []
  const { batchId } = await params
  return <StaffShell userName={staff.name} permissions={permissions}><div className="p-6 space-y-6"><h1 className="text-title-lg font-semibold">PA preparation batch</h1>{!hasPaPermission(permissions, 'PA_PREPARATION_READ') ? <p role="alert">READ permission is required to view this batch.</p> : <BatchWorkspace batchId={batchId} canRead canWrite={hasPaPermission(permissions, 'PA_PREPARATION_WRITE')} />}</div></StaffShell>
}
