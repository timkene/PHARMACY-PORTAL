import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('loadOrdersForPaExport', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('pages GET /api/orders and fills provider from GET /api/orders/{id}', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://test.local'
    const listPage = (orders: unknown[], total: number, page: number) => ({
      ok: true,
      json: async () => ({ orders, total, page }),
    })
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/orders?page=1&limit=100')) {
        return listPage([{
          id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
          intakeId: 'INT-1',
          enrollee: { enrolleeId: '0001', fullName: 'A' },
          medications: [{ name: 'Drug', diagnosis: 'I10', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 }],
          status: 'completed',
          createdAt: '2026-10-01T00:00:00.000Z',
        }], 1, 1) as Response
      }
      if (url.endsWith('/api/orders/aaaaaaaaaaaaaaaaaaaaaaaa')) {
        return {
          ok: true,
          json: async () => ({
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            enrollee: { enrolleeId: '0001', fullName: 'A' },
            provider: { providerId: '04304', providerName: 'Clinic' },
            medications: [{ name: 'Drug', procedureCode: 'DRG-1', diagnosis: 'Hypertension', diagnosisCode: 'I10', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 }],
            status: 'completed',
            createdAt: '2026-10-01T00:00:00.000Z',
            bids: [],
          }),
        } as Response
      }
      if (url.endsWith('/api/aggregators')) {
        return { ok: true, json: async () => [] } as Response
      }
      throw new Error(`unexpected ${url}`)
    })

    const { loadOrdersForPaExport } = await import('../api')
    const orders = await loadOrdersForPaExport()
    expect(vi.mocked(fetch).mock.calls.map(call => String(call[0]))).toEqual(expect.arrayContaining([
      'http://test.local/api/orders?page=1&limit=100',
      'http://test.local/api/orders/aaaaaaaaaaaaaaaaaaaaaaaa',
    ]))
    expect(orders[0].provider).toEqual({ providerId: '04304', providerName: 'Clinic' })
    expect(orders[0].medications[0].procedureCode).toBe('DRG-1')
  })

  it('fills assigned aggregator from order detail and GET /api/aggregators without using the hospital provider', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://test.local'
    const listPage = (orders: unknown[], total: number, page: number) => ({
      ok: true,
      json: async () => ({ orders, total, page }),
    })
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/orders?page=1&limit=100')) {
        return listPage([{
          id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
          enrollee: { enrolleeId: '0001', fullName: 'A' },
          provider: { providerId: '04304', providerName: 'Referring Hospital' },
          medications: [{ name: 'Drug', diagnosis: 'I10', dosage: '1', quantity: 14, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 }],
          status: 'completed',
          winnerName: 'Listed Name Only',
          createdAt: '2026-10-01T00:00:00.000Z',
        }], 1, 1) as Response
      }
      if (url.endsWith('/api/orders/aaaaaaaaaaaaaaaaaaaaaaaa')) {
        return {
          ok: true,
          json: async () => ({
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            enrollee: { enrolleeId: '0001', fullName: 'A' },
            provider: { providerId: '04304', providerName: 'Referring Hospital' },
            medications: [{ name: 'Drug', procedureCode: 'DRG-1', diagnosis: 'Hypertension', diagnosisCode: 'I10', dosage: '1', quantity: 14, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 }],
            status: 'completed',
            winnerId: '00agg9',
            bids: [],
            createdAt: '2026-10-01T00:00:00.000Z',
          }),
        } as Response
      }
      if (url.endsWith('/api/aggregators')) {
        return {
          ok: true,
          json: async () => ([
            { id: '00agg9', companyName: 'Assigned Pharmacy Hub', medicloudProviderId: '22342', contactName: 'A', email: 'hub@example.test' },
            { id: 'other', companyName: 'Other Hub', contactName: 'B', email: 'other@example.test' },
          ]),
        } as Response
      }
      throw new Error(`unexpected ${url}`)
    })

    const { loadOrdersForPaExport } = await import('../api')
    const orders = await loadOrdersForPaExport()
    expect(vi.mocked(fetch).mock.calls.map(call => String(call[0]))).toEqual(expect.arrayContaining([
      'http://test.local/api/orders?page=1&limit=100',
      'http://test.local/api/orders/aaaaaaaaaaaaaaaaaaaaaaaa',
      'http://test.local/api/aggregators',
    ]))
    expect(orders[0].winnerId).toBe('00agg9')
    expect(orders[0].winnerName).toBe('Assigned Pharmacy Hub')
    expect(orders[0].aggregatorMedicloudProviderId).toBe('22342')
    expect(orders[0].provider).toEqual({ providerId: '04304', providerName: 'Referring Hospital' })
    expect(orders[0].medications[0].quantity).toBe(14)
  })

  it('loads every order across paginated GET /api/orders responses', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://test.local'
    const page = (orders: { id: string }[], total: number, pageNumber: number) => ({
      ok: true,
      json: async () => ({ orders: orders.map(order => ({
        ...order,
        enrollee: { enrolleeId: order.id, fullName: 'Synthetic' },
        provider: { providerId: '04304', providerName: 'Clinic' },
        medications: [{ name: 'Drug', procedureCode: 'DRG-1', diagnosis: 'Hypertension', diagnosisCode: 'I10', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 }],
        status: 'completed',
        createdAt: '2026-10-01T00:00:00.000Z',
      })), total, page: pageNumber }),
    })
    const first = Array.from({ length: 100 }, (_, index) => ({ id: `page1-${String(index).padStart(3, '0')}` }))
    const second = [{ id: 'page2-000' }]
    vi.mocked(fetch)
      .mockResolvedValueOnce(page(first, 101, 1) as Response)
      .mockResolvedValueOnce(page(second, 101, 2) as Response)

    const { getAllStaffOrders } = await import('../api')
    const orders = await getAllStaffOrders()
    expect(fetch).toHaveBeenNthCalledWith(1, 'http://test.local/api/orders?page=1&limit=100', expect.any(Object))
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://test.local/api/orders?page=2&limit=100', expect.any(Object))
    expect(orders).toHaveLength(101)
    expect(orders.at(-1)?.id).toBe('page2-000')
  })
})
