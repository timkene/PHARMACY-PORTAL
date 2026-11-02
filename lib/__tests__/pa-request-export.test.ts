import { describe, expect, it } from 'vitest'
import type { Medication, Order } from '../types'
import {
  EXPORT_COLUMNS,
  filterExportLines,
  flattenOrder,
  flattenOrders,
  selectedOrFiltered,
  toCsv,
  toXlsx,
} from '../pa-request-export'

function medication(overrides: Partial<Medication> = {}): Medication {
  return {
    lineId: 'line-a',
    name: 'Amlodipine 10mg',
    procedureCode: 'DRG-001',
    diagnosis: 'Hypertension',
    diagnosisCode: 'I10',
    dosage: '1',
    quantity: 30,
    tablets: 1,
    frequency: 'every 24 hrs',
    durationDays: 30,
    ...overrides,
  }
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    intakeId: 'INT-1',
    enrollee: { enrolleeId: '00012345', fullName: 'Synthetic Member' },
    provider: { providerId: '04304', providerName: 'Synthetic Clinic' },
    medications: [medication()],
    status: 'completed',
    bids: [],
    winnerId: 'agg-001',
    winnerName: 'Clearline Pharmacy Hub',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

function parseCsv(csv: string): string[][] {
  const text = csv.replace(/^\uFEFF/, '').trim()
  return text.split(/\r\n/).map(row => {
    const cells: string[] = []
    let current = ''
    let quoted = false
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i]
      if (quoted) {
        if (ch === '"' && row[i + 1] === '"') { current += '"'; i += 1 }
        else if (ch === '"') quoted = false
        else current += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') { cells.push(current); current = '' }
      else current += ch
    }
    cells.push(current)
    return cells
  })
}

describe('PA request export rows', () => {
  it('uses the eight confirmed columns in order', () => {
    expect(EXPORT_COLUMNS).toEqual([
      'Enrollee ID',
      'Procedure Name',
      'Procedure Code',
      'Quantity',
      'Diagnosis Name',
      'Diagnosis Code',
      'Aggregator ID',
      'Aggregator Name',
    ])
  })

  it('uses one row per medication and repeats enrollee, diagnosis, and aggregator fields', () => {
    const rows = flattenOrder(order({
      medications: [
        medication({ lineId: 'a', name: 'Drug A', procedureCode: 'DRG-A', quantity: 10, diagnosis: 'Hypertension', diagnosisCode: 'I10' }),
        medication({ lineId: 'b', name: 'Drug B', procedureCode: 'DRG-B', quantity: 20, diagnosis: 'Diabetes', diagnosisCode: 'E11' }),
      ],
    }))
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.cells['Procedure Code'])).toEqual(['DRG-A', 'DRG-B'])
    expect(rows.map(row => row.cells['Quantity'])).toEqual(['10', '20'])
    expect(rows.every(row => row.cells['Enrollee ID'] === '00012345')).toBe(true)
    expect(rows.every(row => row.cells['Aggregator ID'] === 'agg-001')).toBe(true)
    expect(rows.every(row => row.cells['Aggregator Name'] === 'Clearline Pharmacy Hub')).toBe(true)
    expect(rows.some(row => Object.keys(row.cells).includes('Provider ID'))).toBe(false)
    expect(rows.some(row => Object.keys(row.cells).includes('Provider Name'))).toBe(false)
  })

  it('maps quantity from the medication request and aggregator from the assigned pharmacy, not the hospital', () => {
    const api = order({
      provider: { providerId: '04304', providerName: 'Referring Hospital' },
      winnerId: '00agg9',
      winnerName: 'Assigned Pharmacy',
      medications: [medication({ quantity: 90, tablets: 2 })],
    })
    const [row] = flattenOrder(api)
    expect(row.cells).toEqual({
      'Enrollee ID': api.enrollee.enrolleeId,
      'Procedure Name': api.medications[0].name,
      'Procedure Code': api.medications[0].procedureCode,
      'Quantity': '90',
      'Diagnosis Name': api.medications[0].diagnosis,
      'Diagnosis Code': api.medications[0].diagnosisCode,
      'Aggregator ID': '00agg9',
      'Aggregator Name': 'Assigned Pharmacy',
    })
    expect(row.cells['Aggregator ID']).not.toBe(api.provider?.providerId)
    expect(row.cells['Aggregator Name']).not.toBe(api.provider?.providerName)
    expect(row.cells['Quantity']).not.toBe('2')
  })

  it('leaves missing quantity, codes, and aggregator values blank and does not substitute provider data', () => {
    const [row] = flattenOrder(order({
      winnerId: undefined,
      winnerName: undefined,
      diagnosis: 'Should not be used as a code',
      medications: [{
        lineId: 'a',
        name: 'Uncoded drug',
        diagnosis: 'Known diagnosis',
        dosage: '1',
        tablets: 4,
        frequency: 'every 24 hrs',
        durationDays: 1,
      } as Medication],
    }))
    expect(row.cells['Procedure Code']).toBe('')
    expect(row.cells['Diagnosis Code']).toBe('')
    expect(row.cells['Diagnosis Name']).toBe('Known diagnosis')
    expect(row.cells['Quantity']).toBe('')
    expect(row.cells['Aggregator ID']).toBe('')
    expect(row.cells['Aggregator Name']).toBe('')
  })

  it('filters by date, provider, and enrollee without dropping leading zeros', () => {
    const rows = flattenOrders([
      order({ id: '1', createdAt: '2026-09-30T12:00:00.000Z', enrollee: { enrolleeId: '000111', fullName: 'A' } }),
      order({ id: '2', createdAt: '2026-10-02T12:00:00.000Z', enrollee: { enrolleeId: '000222', fullName: 'B' }, provider: { providerId: '99', providerName: 'Other Pharmacy' } }),
    ])
    const filtered = filterExportLines(rows, { from: '2026-10-01', to: '2026-10-31', provider: '04304', enrollee: '000222' })
    expect(filtered).toEqual([])
    const byDate = filterExportLines(rows, { from: '2026-10-01', to: '2026-10-31' })
    expect(byDate).toHaveLength(1)
    expect(byDate[0].cells['Enrollee ID']).toBe('000222')
    const byProvider = filterExportLines(rows, { provider: 'synthetic clinic' })
    expect(byProvider.map(row => row.orderId)).toEqual(['1'])
    const byEnrollee = filterExportLines(rows, { enrollee: '000111' })
    expect(byEnrollee[0].cells['Enrollee ID']).toBe('000111')
  })

  it('exports all filtered rows unless a selection is present', () => {
    const rows = flattenOrders([order({ id: '1' }), order({ id: '2', enrollee: { enrolleeId: '000999', fullName: 'C' } })])
    expect(selectedOrFiltered(rows, new Set())).toHaveLength(2)
    expect(selectedOrFiltered(rows, new Set([rows[1].key]))).toEqual([rows[1]])
  })

  it('CSV of filtered rows includes matches beyond the visible table page size', () => {
    const rows = flattenOrders(Array.from({ length: 30 }, (_, index) => order({
      id: String(index + 1),
      enrollee: { enrolleeId: `000${String(index).padStart(2, '0')}`, fullName: 'Synthetic' },
    })))
    const filtered = filterExportLines(rows, { enrollee: '000' })
    expect(filtered).toHaveLength(30)
    const csv = toCsv(selectedOrFiltered(filtered, new Set()))
    expect(csv.split(/\r\n/).filter(Boolean)).toHaveLength(31)
    expect(csv).toContain('00000')
    expect(csv).toContain('00029')
  })
})

describe('PA request export files', () => {
  it('writes an eight-column CSV that preserves leading zeros and blocks formula injection', () => {
    const rows = flattenOrder(order({
      enrollee: { enrolleeId: '00012345', fullName: 'Synthetic' },
      winnerId: '00agg1',
      winnerName: '=Pharmacy()',
      medications: [medication({
        lineId: 'a', name: '=SUM(1)', procedureCode: '+CMD', diagnosis: '@Danger', diagnosisCode: '-I10', quantity: 7,
      })],
    }))
    const table = parseCsv(toCsv(rows))
    expect(table[0]).toEqual([...EXPORT_COLUMNS])
    expect(table[1]).toEqual([
      '00012345', "'=SUM(1)", "'+CMD", '7', "'@Danger", "'-I10", '00agg1', "'=Pharmacy()",
    ])
    expect(toCsv(rows)).not.toContain('Synthetic Clinic')
    expect(toCsv(rows)).not.toContain('04304')
    expect(toCsv(rows).startsWith('\uFEFF')).toBe(true)
  })

  it('writes an xlsx package containing the same eight columns as text', () => {
    const rows = flattenOrder(order())
    const bytes = toXlsx(rows)
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('PK\u0003\u0004')
    const xml = new TextDecoder().decode(bytes)
    for (const column of EXPORT_COLUMNS) expect(xml).toContain(column)
    expect(xml).not.toContain('Provider ID')
    expect(xml).not.toContain('Provider Name')
    expect(xml).toContain('00012345')
    expect(xml).toContain('30')
    expect(xml).toContain('agg-001')
    expect(xml).toContain('Clearline Pharmacy Hub')
    expect(xml).toContain('t="inlineStr"')
  })

  it('does not put internal request identifiers in the exported files', () => {
    const rows = flattenOrder(order({ id: 'deadbeefdeadbeefdeadbeef', intakeId: 'SECRET-INTAKE' }))
    const csv = toCsv(rows)
    expect(csv).not.toContain('deadbeefdeadbeefdeadbeef')
    expect(csv).not.toContain('SECRET-INTAKE')
    expect(csv).not.toContain(rows[0].key)
    const xml = new TextDecoder().decode(toXlsx(rows))
    expect(xml).not.toContain('deadbeefdeadbeefdeadbeef')
    expect(xml).not.toContain('SECRET-INTAKE')
  })
})
