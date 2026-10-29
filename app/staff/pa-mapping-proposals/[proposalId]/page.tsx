import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth'
import { hasPaPermission } from '@/lib/pa-permissions'
import { StaffShell } from '@/components/staff/StaffShell'
import { ProposalDetail } from '@/components/staff/pa/ProposalDetail'
export default async function MappingProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const staff = await getStaffSession()
  if (!staff) redirect('/staff/login')
  const permissions = staff.permissions ?? []
  const { proposalId } = await params
  return hasPaPermission(permissions, 'PA_MAPPING_REVIEW')
    ? <ProposalDetail proposalId={proposalId} userId={staff.userId} userName={staff.name} permissions={permissions} />
    : <StaffShell userName={staff.name} permissions={permissions}><div className="p-6"><p role="alert">PA_MAPPING_REVIEW permission is required to view this proposal.</p></div></StaffShell>
}
