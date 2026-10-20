import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { PreparationList } from '@/components/staff/pa/PreparationList'
export default async function PreparationPage() {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  return <PreparationList userName={staff.name} permissions={staff.permissions ?? []} />
}
