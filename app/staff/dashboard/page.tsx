import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { StaffDashboardClient } from './client'

export default async function StaffDashboardPage() {
  const session = await getStaffSession()
  if (!session) redirect('/staff/login')
  return <StaffDashboardClient userName={session.name} />
}
