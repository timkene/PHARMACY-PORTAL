import { describe, expect, it } from 'vitest'
import { isDirectApproved } from '../types'

describe('isDirectApproved', () => {
  it.each([0, 1500])('recognizes backend approval with total %s', winnerTotalPrice => {
    expect(isDirectApproved({ assignmentType: 'direct', priceApprovedAt: '2026-09-17T00:00:00Z', winnerTotalPrice })).toBe(true)
  })

  it.each([null, undefined, ''])('requires an approval timestamp (%s)', priceApprovedAt => {
    expect(isDirectApproved({ assignmentType: 'direct', priceApprovedAt, winnerTotalPrice: 1500 })).toBe(false)
  })

  it.each([null, undefined])('requires an approved total (%s)', winnerTotalPrice => {
    expect(isDirectApproved({ assignmentType: 'direct', priceApprovedAt: '2026-09-17T00:00:00Z', winnerTotalPrice })).toBe(false)
  })

  it.each(['competitive', undefined] as const)('does not classify %s orders as direct approval', assignmentType => {
    expect(isDirectApproved({ assignmentType, priceApprovedAt: '2026-09-17T00:00:00Z', winnerTotalPrice: 1500 })).toBe(false)
  })
})
