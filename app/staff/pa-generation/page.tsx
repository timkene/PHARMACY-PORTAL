import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { GenerationLookup } from '@/components/staff/pa/GenerationWorkspace'
export default async function PaGenerationPage() {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  return <GenerationLookup userName={staff.name} permissions={staff.permissions ?? []} />
}
