import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { MappingReviewWorkspace } from '@/components/staff/pa/MappingReviewWorkspace'
export default async function MappingReviewPage() {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  return <MappingReviewWorkspace userName={staff.name} permissions={staff.permissions ?? []} />
}
