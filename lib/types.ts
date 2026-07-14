export interface Medication {
  name: string
  dosage: string
  quantity: number
}

export interface Enrollee {
  fullName: string
  email: string
  phone: string
  address: string
}

export interface Bid {
  id: string
  aggregatorId: string
  aggregatorName: string
  reliabilityScore: number
  unitPrice: number
  totalPrice: number
  deliveryTimeline: string
  isCheapest: boolean
  submittedAt: string
}

export type OrderStatus =
  | 'bidding'
  | 'awaiting_fulfillment'
  | 'collection_verified'
  | 'fulfilled'

export interface Order {
  id: string
  intakeId: string
  enrollee: Enrollee
  diagnosis: string
  medications: Medication[]
  status: OrderStatus
  bids: Bid[]
  winnerId?: string
  winnerName?: string
  winnerTotalPrice?: number
  biddingEndsAt: string
  approvalCode?: string
  createdAt: string
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

export interface BidUpdateEvent {
  bids: Bid[]
  cheapestId: string
}

export interface SessionClosedEvent {
  winnerId: string
  winnerName: string
  totalPrice: number
}

export interface CollectionVerifiedEvent {
  verifiedAt: string
}

export interface ApprovalGeneratedEvent {
  approvalCode: string
}
