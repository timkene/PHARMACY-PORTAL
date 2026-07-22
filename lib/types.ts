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
  isCheapest: boolean
  submittedAt: string
}

export type OrderStatus =
  | 'bidding'
  | 'awaiting_fulfillment'
  | 'accepted'
  | 'awaiting_confirmation'
  | 'completed'
  | 'not_received'

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
  winnerTotalPrice?: number
  biddingEndsAt: string
  createdAt: string
  completedAt?: string
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
