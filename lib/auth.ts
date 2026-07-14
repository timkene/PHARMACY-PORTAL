import { cookies } from 'next/headers'

export interface StaffSession {
  userId: string
  name: string
  email: string
}

export interface AggregatorSession {
  userId: string
  name: string
  email: string
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('staff_session')?.value
  if (!token) return null
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString()) as StaffSession
  } catch {
    return null
  }
}

export async function getAggregatorSession(): Promise<AggregatorSession | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('aggregator_session')?.value
  if (!token) return null
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString()) as AggregatorSession
  } catch {
    return null
  }
}
