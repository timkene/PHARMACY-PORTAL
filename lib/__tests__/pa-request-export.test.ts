import { describe, expect, it } from 'vitest'
import type { Order } from '../types'
import {
  EXPORT_COLUMNS,
  filterExportLines,
  flattenOrder,
  flattenOrders,
  selectedOrFiltered,
  toCsv,
  toXlsx,
} from '../pa-request-export'

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    intakeId: 'INT-1',
    enrollee: { enrolleeId: '00012345', fullName: 'Synthetic Member' },
    provider: { providerId: '04304', providerName: 'Synthetic Clinic' },
    medications: [{
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
    }],
    status: 'completed',
    bids: [],
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
  it('uses one row per medication and repeats enrollee and provider fields', () => {
    const rows = flattenOrder(order({
      medications: [
        { lineId: 'a', name: 'Drug A', procedureCode: 'DRG-A', diagnosis: 'Hypertension', diagnosisCode: 'I10', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 },
        { lineId: 'b', name: 'Drug B', procedureCode: 'DRG-B', diagnosis: 'Diabetes', diagnosisCode: 'E11', dosage: '1', quantity: 2, tablets: 1, frequency: 'every 12 hrs', durationDays: 7 },
      ],
    }))
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.cells['Procedure Code'])).toEqual(['DRG-A', 'DRG-B'])
    expect(rows.every(row => row.cells['Enrollee ID'] === '00012345')).toBe(true)
    expect(rows.every(row => row.cells['Provider ID'] === '04304')).toBe(true)
    expect(rows.every(row => row.cells['Provider Name'] === 'Synthetic Clinic')).toBe(true)
  })

  it('leaves missing procedure and diagnosis codes blank and does not substitute', () => {
    const [row] = flattenOrder(order({
      diagnosis: 'Should not be used as a code',
      medications: [{
        lineId: 'a', name: 'Uncoded drug', diagnosis: 'Known diagnosis', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1,
      }],
    }))
    expect(row.cells['Procedure Code']).toBe('')
    expect(row.cells['Diagnosis Code']).toBe('')
    expect(row.cells['Diagnosis Name']).toBe('Known diagnosis')
    expect(row.cells['Procedure Name']).toBe('Uncoded drug')
  })

  it('matches exported cells to the original API order fields', () => {
    const api = order()
    const [row] = flattenOrder(api)
    expect(row.cells).toEqual({
      'Enrollee ID': api.enrollee.enrolleeId,
      'Procedure Name': api.medications[0].name,
      'Procedure Code': api.medications[0].procedureCode,
      'Diagnosis Name': api.medications[0].diagnosis,
      'Diagnosis Code': api.medications[0].diagnosisCode,
      'Provider ID': api.provider?.providerId,
      'Provider Name': api.provider?.providerName,
    })
    expect(EXPORT_COLUMNS).toEqual([
      'Enrollee ID', 'Procedure Name', 'Procedure Code', 'Diagnosis Name', 'Diagnosis Code', 'Provider ID', 'Provider Name',
    ])
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
  it('writes a seven-column CSV that preserves leading zeros and blocks formula injection', () => {
    const rows = flattenOrder(order({
      enrollee: { enrolleeId: '00012345', fullName: 'Synthetic' },
      medications: [{
        lineId: 'a', name: '=SUM(1)', procedureCode: '+CMD', diagnosis: '@Danger', diagnosisCode: '-I10', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1,
      }],
    }))
    const table = parseCsv(toCsv(rows))
    expect(table[0]).toEqual([...EXPORT_COLUMNS])
    expect(table[1]).toEqual(["00012345", "'=SUM(1)", "'+CMD", "'@Danger", "'-I10", "04304", "Synthetic Clinic"])
    expect(toCsv(rows).startsWith('\uFEFF')).toBe(true)
  })

  it('writes an xlsx package containing the same seven columns as text', () => {
    const rows = flattenOrder(order())
    const bytes = toXlsx(rows)
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('PK\u0003\u0004')
    const xml = new TextDecoder().decode(bytes)
    for (const column of EXPORT_COLUMNS) expect(xml).toContain(column)
    expect(xml).toContain('00012345')
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
