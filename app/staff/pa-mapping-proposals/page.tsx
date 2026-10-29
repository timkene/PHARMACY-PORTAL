import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { ProposalList } from '@/components/staff/pa/ProposalList'
export default async function MappingProposalsPage() {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  return <ProposalList userName={staff.name} permissions={staff.permissions ?? []} />
}
