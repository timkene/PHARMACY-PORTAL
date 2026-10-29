import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { GenerationWorkspace } from '@/components/staff/pa/GenerationWorkspace'
export default async function PaGenerationOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  const { orderId } = await params
  return <GenerationWorkspace orderId={orderId} userName={staff.name} permissions={staff.permissions ?? []} />
}
