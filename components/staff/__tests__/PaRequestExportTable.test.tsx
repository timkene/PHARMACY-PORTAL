import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PaRequestExportTable } from '../PaRequestExportTable'
import { EXPORT_COLUMNS } from '@/lib/pa-request-export'
import type { Order } from '@/lib/types'

const loadOrdersForPaExport = vi.fn()
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { status = 500 },
  loadOrdersForPaExport: (...args: unknown[]) => loadOrdersForPaExport(...args),
  logout: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/request-export',
  useRouter: () => ({ push: vi.fn() }),
}))

function order(id: string, meds: Order['medications'], extra: Partial<Order> = {}): Order {
  return {
    id,
    intakeId: `INT-${id}`,
    enrollee: { enrolleeId: extra.enrollee?.enrolleeId ?? `CL/${id}`, fullName: 'Member' },
    provider: extra.provider ?? { providerId: '4304', providerName: 'Clinic A' },
    medications: meds,
    status: 'completed',
    bids: [],
    createdAt: extra.createdAt ?? '2026-10-15T08:00:00.000Z',
    ...extra,
  }
}

const med = (name: string, code?: string): Order['medications'][number] => ({
  lineId: name, name, procedureCode: code, diagnosis: 'Hypertension', diagnosisCode: 'I10',
  dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1,
})

describe('PaRequestExportTable', () => {
  beforeEach(() => {
    loadOrdersForPaExport.mockReset()
    loadOrdersForPaExport.mockResolvedValue([
      order('one', [med('Drug A', 'DRG-A'), med('Drug B', 'DRG-B')]),
      order('two', [med('Drug C', 'DRG-C')], { enrollee: { enrolleeId: '000999', fullName: 'Other' }, provider: { providerId: '8800', providerName: 'Clinic B' }, createdAt: '2026-09-01T00:00:00.000Z' }),
    ])
  })

  it('renders one row per procedure and exports filtered results across the table', async () => {
    render(<PaRequestExportTable userName="Staff" />)
    expect(await screen.findByText('Drug A')).toBeInTheDocument()
    expect(EXPORT_COLUMNS).toEqual([
      'Enrollee ID', 'Procedure Name', 'Procedure Code', 'Diagnosis Name', 'Diagnosis Code', 'Provider ID', 'Provider Name',
    ])
    for (const column of EXPORT_COLUMNS) expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument()
    expect(screen.getByText('Drug B')).toBeInTheDocument()
    expect(screen.getByText('Drug C')).toBeInTheDocument()
    expect(screen.getByText(/2 requests · 3 procedure rows/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Enrollee'), { target: { value: '000999' } })
    await waitFor(() => expect(screen.queryByText('Drug A')).not.toBeInTheDocument())
    expect(screen.getByText('Drug C')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Enrollee'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'Clinic A' } })
    await waitFor(() => expect(screen.queryByText('Drug C')).not.toBeInTheDocument())
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('selects matching rows across the current filter', async () => {
    render(<PaRequestExportTable userName="Staff" />)
    await screen.findByText('Drug A')
    fireEvent.click(screen.getByText('Select all matching'))
    expect(screen.getByText(/3 selected/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Download Excel' })).toBeEnabled()
  })
})
