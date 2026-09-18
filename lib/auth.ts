import { cookies } from 'next/headers'
import { STAFF_SESSION_COOKIE } from './constants'
import { ApiError, getStaffIdentity } from './api'
import type { StaffIdentity } from './types'

export type StaffSession = StaffIdentity

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value
  if (!token) return null

  try {
    // Forward only this credential; the backend validates its signature and staff role.
    return await getStaffIdentity({ Cookie: `${STAFF_SESSION_COOKIE}=${encodeURIComponent(token)}` })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    // Outages and invalid backend responses are errors, not authenticated sessions.
    throw error
  }
}
