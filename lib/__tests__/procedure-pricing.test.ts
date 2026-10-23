import { describe, expect, it } from 'vitest'
import { medicationSubtotal, parseMoney, procedurePrices } from '../procedure-pricing'
import type { Medication } from '../types'

const medications = [
  { lineId: 'a', procedureCode: 'DRG-A', name: 'A' },
  { lineId: 'b', procedureCode: 'DRG-B', name: 'B', quantity: 3 },
] as Medication[]

describe('procedure pricing', () => {
  it.each(['', '0', '-1', 'NaN', 'Infinity', '1e309', 'abc', '1.001'])('rejects %s', value => {
    expect(parseMoney(value)).toBeNull()
  })
  it('requires every stable medication line and calculates the subtotal', () => {
    expect(procedurePrices(medications, { a: '3000' })).toBeNull()
    const lines = procedurePrices(medications, { a: '3000', b: '4000' })!
    expect(lines).toEqual([
      { medicationLineId: 'a', procedureCode: 'DRG-A', amount: 3000 },
      { medicationLineId: 'b', procedureCode: 'DRG-B', amount: 4000 },
    ])
    expect(medicationSubtotal(lines)).toBe(7000)
  })
})
