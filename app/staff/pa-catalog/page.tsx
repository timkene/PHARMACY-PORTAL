import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { CatalogWorkspace } from '@/components/staff/pa/CatalogWorkspace'
export default async function CatalogPage() {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  return <CatalogWorkspace userName={staff.name} permissions={staff.permissions ?? []} />
}
