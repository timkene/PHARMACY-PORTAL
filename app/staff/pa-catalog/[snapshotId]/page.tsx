import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { hasPaPermission } from '@/lib/pa-permissions'
import { StaffShell } from '@/components/staff/StaffShell'
import { CatalogDetail } from '@/components/staff/pa/CatalogDetail'
export default async function CatalogDetailPage({ params }: { params: Promise<{ snapshotId: string }> }) {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  const permissions = staff.permissions ?? []
  const { snapshotId } = await params
  return hasPaPermission(permissions, 'PA_CATALOG_READ')
    ? <CatalogDetail snapshotId={snapshotId} userId={staff.userId} userName={staff.name} permissions={permissions} />
    : <StaffShell userName={staff.name} permissions={permissions}><div className="p-6"><p role="alert">PA_CATALOG_READ permission is required to verify this snapshot.</p></div></StaffShell>
}
