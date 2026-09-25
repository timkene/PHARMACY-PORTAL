export interface Enrollee {
  enrolleeId: string
  fullName: string
  phone?: string
  address?: string
}

export interface Provider {
  providerId: string
  providerName: string
}

export type MedicationFrequency =
  | 'every 24 hrs'
  | 'every 12 hrs'
  | 'every 8 hrs'
  | 'every 6 hrs'
  | 'every week'
  | 'every month'

export interface Medication {
  lineId?: string
  procedureCode?: string
  name: string
  dosage: string
  quantity: number
  tablets: number
  frequency: MedicationFrequency | ''
  durationDays: number
  diagnosisCode?: string
  diagnosis: string
}

export interface Bid {
  id: string
  aggregatorId: string
  aggregatorName: string
  unitPrice: number
  totalPrice: number
  procedurePrices?: import('./procedure-pricing').ProcedurePrice[] | null
  isCheapest: boolean
  submittedAt: string
}

export type OrderStatus =
  | 'direct_quote_requested'
  | 'direct_price_review'
  | 'direct_reassignment'
  | 'clearline_price_review'
  | 'cancelled'
  | 'post_fulfilment_recalled'
  | 'fulfilled'
  | 'pending_review'
  | 'rejected'
  | 'bidding'
  | 'awaiting_fulfillment'
  | 'accepted'
  | 'awaiting_confirmation'
  | 'completed'
  | 'not_received'

export interface ExpectedVersion { expectedVersion: number }

export interface DirectQuoteRequest extends ExpectedVersion {
  procedurePrices?: import('./procedure-pricing').ProcedurePrice[]
  totalPrice?: number // Legacy orders without medication line IDs only.
}

export interface LifecycleResponse {
  success: boolean
  status: OrderStatus
  version: number
  assignmentVersion: number
}

export interface DirectQuote {
  totalPrice: number
  procedurePrices?: import('./procedure-pricing').ProcedurePrice[] | null
  submittedAt: string
  aggregatorId: string
  assignmentVersion: number
}

export interface Order {
  id: string
  intakeId: string
  enrollee: Enrollee
  provider?: Provider
  diagnosis?: string
  medications: Medication[]
  status: OrderStatus
  bids: Bid[]
  winnerId?: string
  winnerName?: string
  assignmentType?: 'direct' | 'competitive'
  version?: number
  assignmentVersion?: number
  directQuote?: DirectQuote | null
  priceApprovedAt?: string | null
  acceptedAt?: string | null
  fulfilledAt?: string | null
  cancelledAt?: string | null
  recalledAt?: string | null
  winnerTotalPrice?: number | null
  quotedProcedurePrices?: import('./procedure-pricing').ProcedurePrice[] | null
  approvedProcedurePrices?: import('./procedure-pricing').ProcedurePrice[] | null
  finalProcedurePrices?: import('./procedure-pricing').ProcedurePrice[] | null
  medicationSubtotal?: number | null
  overallTotal?: number | null
  fulfillmentType?: 'delivered' | 'picked_up'
  deliveryFee?: number
  biddingEndsAt?: string
  createdAt: string
  completedAt?: string
}

export interface StaffIdentity {
  userId: string
  name: string
  email: string
}

export interface StaffUser {
  id: string
  name: string
  email: string
}

export interface AggregatorUser {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
}

export interface DashboardStats {
  activeBidding: number
  awaitingFulfillment: number
  completedToday: number
}

export interface AggregatorDashboard {
  openSessions: Order[]
  wonOrders: Order[]
  completedOrders: Order[]
}

export interface AggregatorOrdersResponse {
  open: Order[]
  active: Order[]
  fulfilled: Order[]
  counts: { open: number; active: number; fulfilled: number }
}

export interface BidUpdateEvent {
  bids: Bid[]
  cheapestId: string
}

export interface SessionClosedEvent {
  winnerId: string
  winnerName: string
  totalPrice: number
}

export interface OrderAcceptedEvent {
  aggregatorName: string
}

export interface OrderFulfilledEvent {}

export interface OrderCompletedEvent {
  received: boolean
}

export interface SearchResult {
  code: string
  label: string
}

/** Direct approval is supplied by the backend, independently of lifecycle status. */
export function isDirectApproved(order: Pick<Order, 'assignmentType' | 'priceApprovedAt' | 'winnerTotalPrice'>): boolean {
  return order.assignmentType === 'direct' && !!order.priceApprovedAt && order.winnerTotalPrice != null
}
