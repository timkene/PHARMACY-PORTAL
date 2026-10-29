import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { PaRequestExportTable } from '@/components/staff/PaRequestExportTable'

export default async function RequestExportPage() {
  const session = await getStaffSession()
  if (!session) redirect('/staff/login')
  return <PaRequestExportTable userName={session.name} permissions={session.permissions ?? []} />
}
