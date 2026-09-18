import { StatusChip } from '@/components/shared/StatusChip'
import { isDirectApproved, type Order } from '@/lib/types'

const labels: Record<string, string> = {
  direct_quote_requested: 'Price Required',
  direct_price_review: 'Awaiting Clearline Approval',
  direct_reassignment: 'Assignment Inactive',
  awaiting_fulfillment: 'Awaiting Acceptance',
  accepted: 'Accepted',
  awaiting_confirmation: 'Fulfilled — Awaiting Confirmation',
  fulfilled: 'Fulfilled',
  completed: 'Completed',
  not_received: 'Not Received',
  cancelled: 'Cancelled',
  post_fulfilment_recalled: 'Recalled After Fulfilment',
  bidding: 'Bidding',
  clearline_price_review: 'Awaiting Clearline Approval',
}

export function AssignmentStatus({ order }: { order: Order }) {
  const direct = order.assignmentType === 'direct'
  const inactive = ['direct_reassignment', 'cancelled', 'post_fulfilment_recalled'].includes(order.status)
  const label = direct && order.status === 'awaiting_fulfillment'
    ? isDirectApproved(order) ? 'Approved — Accept Order' : 'Awaiting Clearline Approval'
    : labels[order.status] ?? order.status.replace(/_/g, ' ')
  return <StatusChip status={inactive ? 'error' : 'info'} label={`${direct ? 'Direct • ' : ''}${label}`} />
}
