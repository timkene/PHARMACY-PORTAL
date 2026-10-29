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
    vi.mocked(fetch)
      .mockResolvedValueOnce(listPage([{
        id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        intakeId: 'INT-1',
        enrollee: { enrolleeId: '0001', fullName: 'A' },
        medications: [{ name: 'Drug', diagnosis: 'I10', dosage: '1', quantity: 1, tablets: 1, frequency: 'every 24 hrs', durationDays: 1 }],
        status: 'completed',
        createdAt: '2026-10-01T00:00:00.000Z',
      }], 1, 1) as Response)
      .mockResolvedValueOnce({
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
      } as Response)

    const { loadOrdersForPaExport } = await import('../api')
    const orders = await loadOrdersForPaExport()
    expect(fetch).toHaveBeenNthCalledWith(1, 'http://test.local/api/orders?page=1&limit=100', expect.any(Object))
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://test.local/api/orders/aaaaaaaaaaaaaaaaaaaaaaaa', expect.any(Object))
    expect(orders[0].provider).toEqual({ providerId: '04304', providerName: 'Clinic' })
    expect(orders[0].medications[0].procedureCode).toBe('DRG-1')
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
