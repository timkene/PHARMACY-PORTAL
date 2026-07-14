import { cookies } from 'next/headers'
import { STAFF_SESSION_COOKIE, AGGREGATOR_SESSION_COOKIE } from './constants'

interface UserSession {
  userId: string
  name: string
  email: string
}

export interface StaffSession extends UserSession {}
export interface AggregatorSession extends UserSession {}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value
  if (!token) return null
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString()) as StaffSession
  } catch {
    return null
  }
}

export async function getAggregatorSession(): Promise<AggregatorSession | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(AGGREGATOR_SESSION_COOKIE)?.value
  if (!token) return null
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString()) as AggregatorSession
  } catch {
    return null
  }
}
