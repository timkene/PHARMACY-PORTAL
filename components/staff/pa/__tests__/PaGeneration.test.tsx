import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import * as orders from '@/lib/api'
import * as gen from '@/lib/pa-generation'
import { getStaffSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Order } from '@/lib/types'
import { GenerationWorkspace } from '../GenerationWorkspace'
import PaGenerationOrderPage from '@/app/staff/pa-generation/[orderId]/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), usePathname: () => '/staff/pa-generation', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ getStaffSession: vi.fn() }))
vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, getOrder: vi.fn() }
})
vi.mock('@/lib/pa-generation', () => ({
  generatePharmacyPa: vi.fn(), markPaVerificationRequired: vi.fn(), verifyPaLine: vi.fn(),
}))

const orderId = '507f1f77bcf86cd799439011'
const order = (overrides: Partial<Order> = {}): Order => ({
  id: orderId, intakeId: 'IN-1', enrollee: { enrolleeId: 'E1', fullName: 'Ada' }, medications: [],
  status: 'completed', bids: [], createdAt: '2026-10-20T00:00:00Z', version: 4,
  paGeneration: { available: true, status: 'not_generated', active: false, interrupted: false, lines: [
    { lineId: 'med-1', procedureCode: 'DRG-CANON', description: 'Canonical', quantity: 1, amount: 1200, status: 'pending', paNumber: null },
  ] },
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(orders.getOrder).mockResolvedValue({ order: order(), bids: [], status: 'completed' })
  vi.mocked(gen.generatePharmacyPa).mockResolvedValue({ status: 'generated', lines: [
    { lineId: 'med-1', procedureCode: 'DRG-CANON', description: 'Canonical', quantity: 1, amount: 1200, status: 'generated', paNumber: 'PA-1' },
  ] })
})

it('redirects unauthenticated generation requests', async () => {
  vi.mocked(getStaffSession).mockResolvedValue(null)
  await expect(PaGenerationOrderPage({ params: Promise.resolve({ orderId }) })).rejects.toThrow('REDIRECT')
  expect(redirect).toHaveBeenCalledWith('/staff/login')
})

it('generates with the loaded expectedVersion after confirmation', async () => {
  render(<GenerationWorkspace orderId={orderId} userName="Staff" />)
  await screen.findByText(/Generation status/)
  fireEvent.click(screen.getByRole('button', { name: 'Generate PA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm PA generation' }))
  await waitFor(() => expect(gen.generatePharmacyPa).toHaveBeenCalledWith(orderId, 4))
})

it('blocks another generate after a rejected 409 and does not retry', async () => {
  vi.mocked(gen.generatePharmacyPa).mockRejectedValue(new ApiError(409, 'All PAs have already been generated'))
  render(<GenerationWorkspace orderId={orderId} userName="Staff" />)
  await screen.findByRole('button', { name: 'Generate PA' })
  fireEvent.click(screen.getByRole('button', { name: 'Generate PA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm PA generation' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no longer available|changed/i))
  expect(gen.generatePharmacyPa).toHaveBeenCalledTimes(1)
})

it('explains forbidden recovery without inventing allowlist membership', async () => {
  vi.mocked(orders.getOrder).mockResolvedValue({ order: order({ paGeneration: { available: true, status: 'interrupted', active: false, interrupted: true, lines: [
    { lineId: 'med-1', procedureCode: 'DRG-CANON', description: 'Canonical', quantity: 1, amount: 1200, status: 'submitting', paNumber: null },
  ] } }), bids: [], status: 'completed' })
  vi.mocked(gen.markPaVerificationRequired).mockRejectedValue(new ApiError(403, 'PA recovery requires an authorized staff account'))
  render(<GenerationWorkspace orderId={orderId} userName="Staff" />)
  await screen.findByRole('button', { name: 'Mark interrupted submission for verification' })
  fireEvent.click(screen.getByRole('button', { name: 'Mark interrupted submission for verification' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm interruption recovery' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission'))
  expect(gen.markPaVerificationRequired).toHaveBeenCalledTimes(1)
})

it('locks generate after an uncertain result until the order is reloaded', async () => {
  vi.mocked(gen.generatePharmacyPa).mockRejectedValue(new ApiError(502, 'down'))
  render(<GenerationWorkspace orderId={orderId} userName="Staff" />)
  await screen.findByRole('button', { name: 'Generate PA' })
  fireEvent.click(screen.getByRole('button', { name: 'Generate PA' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm PA generation' }))
  await waitFor(() => expect(screen.getByText(/outcome is unknown/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Generate PA' })).toBeDisabled()
})

const verifyingLine = {
  lineId: 'med-1', procedureCode: 'DRG-CANON', description: 'Canonical', quantity: 1, amount: 1200,
  status: 'verification_required' as const, paNumber: null, failureKind: 'timeout',
}
const verifyingOrder = () => order({ paGeneration: {
  available: true, status: 'verification_required', active: false, interrupted: false, lines: [verifyingLine],
}})

async function openVerification(resolution: 'existing_pa' | 'confirmed_no_pa' | 'confirmed_rejected') {
  render(<GenerationWorkspace orderId={orderId} userName="Staff" />)
  await screen.findByRole('button', { name: 'Record verification' })
  fireEvent.click(screen.getByRole('button', { name: 'Record verification' }))
  fireEvent.change(screen.getByLabelText('Resolution'), { target: { value: resolution } })
  fireEvent.change(screen.getByLabelText('Evidence'), { target: { value: 'Checked MediCloud PA register' } })
}

it('records existing_pa verification without calling generate', async () => {
  vi.mocked(orders.getOrder).mockResolvedValue({ order: verifyingOrder(), bids: [], status: 'completed' })
  vi.mocked(gen.verifyPaLine).mockResolvedValue({ status: 'generated', line: { lineId: 'med-1', status: 'generated', paNumber: 'PA-9' } })
  await openVerification('existing_pa')
  fireEvent.change(screen.getByLabelText('Verified PA number'), { target: { value: 'PA-9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit verification' }))
  await waitFor(() => expect(gen.verifyPaLine).toHaveBeenCalledWith(orderId, 'med-1', expect.objectContaining({ resolution: 'existing_pa', paNumber: 'PA-9' })))
  expect(gen.generatePharmacyPa).not.toHaveBeenCalled()
})

it('records confirmed_no_pa as failed_retryable and never as generated', async () => {
  vi.mocked(orders.getOrder)
    .mockResolvedValueOnce({ order: verifyingOrder(), bids: [], status: 'completed' })
    .mockResolvedValueOnce({ order: order({ paGeneration: {
      available: true, status: 'partial_failure', active: false, interrupted: false,
      lines: [{ ...verifyingLine, status: 'failed_retryable', paNumber: null, failureKind: null }],
    } }), bids: [], status: 'completed' })
  vi.mocked(gen.verifyPaLine).mockResolvedValue({
    status: 'partial_failure',
    line: { lineId: 'med-1', status: 'failed_retryable', paNumber: null },
  })
  await openVerification('confirmed_no_pa')
  fireEvent.change(screen.getByLabelText('Verification method'), { target: { value: 'portal' } })
  fireEvent.change(screen.getByLabelText('Checked with'), { target: { value: 'MediCloud ops' } })
  fireEvent.change(screen.getByLabelText('Verified at (timezone-aware ISO)'), { target: { value: '2026-10-20T10:00:00Z' } })
  fireEvent.click(screen.getByLabelText('Confirm no PA was created'))
  fireEvent.click(screen.getByLabelText('Confirm authoritative absence'))
  fireEvent.change(screen.getByLabelText('Reconciliation reference'), { target: { value: 'ticket-9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit verification' }))
  await waitFor(() => expect(gen.verifyPaLine).toHaveBeenCalledWith(orderId, 'med-1', expect.objectContaining({
    resolution: 'confirmed_no_pa', confirmNoPaCreated: true, confirmAuthoritativeAbsence: true,
    reconciliationReference: 'ticket-9',
  })))
  expect(gen.generatePharmacyPa).not.toHaveBeenCalled()
  await screen.findByText(/Authoritative absence recorded/i)
  expect(screen.queryByText('Confirmed submitted')).not.toBeInTheDocument()
})

it('records confirmed_rejected as failed_rejected without generating a PA', async () => {
  vi.mocked(orders.getOrder)
    .mockResolvedValueOnce({ order: verifyingOrder(), bids: [], status: 'completed' })
    .mockResolvedValueOnce({ order: order({ paGeneration: {
      available: true, status: 'partial_failure', active: false, interrupted: false,
      lines: [{ ...verifyingLine, status: 'failed_rejected', paNumber: null, failureKind: null }],
    } }), bids: [], status: 'completed' })
  vi.mocked(gen.verifyPaLine).mockResolvedValue({
    status: 'partial_failure',
    line: { lineId: 'med-1', status: 'failed_rejected', paNumber: null },
  })
  await openVerification('confirmed_rejected')
  fireEvent.change(screen.getByLabelText('Verification method'), { target: { value: 'register' } })
  fireEvent.change(screen.getByLabelText('Checked with'), { target: { value: 'MediCloud' } })
  fireEvent.change(screen.getByLabelText('Verified at (timezone-aware ISO)'), { target: { value: '2026-10-20T10:00:00Z' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit verification' }))
  await waitFor(() => expect(gen.verifyPaLine).toHaveBeenCalledWith(orderId, 'med-1', expect.objectContaining({
    resolution: 'confirmed_rejected', verificationMethod: 'register', checkedWith: 'MediCloud',
  })))
  expect(gen.generatePharmacyPa).not.toHaveBeenCalled()
  await screen.findByText(/Rejected — manual review required/)
  expect(screen.queryByText('Confirmed submitted')).not.toBeInTheDocument()
})

it('explains forbidden verification 403 without inventing recovery membership', async () => {
  vi.mocked(orders.getOrder).mockResolvedValue({ order: verifyingOrder(), bids: [], status: 'completed' })
  vi.mocked(gen.verifyPaLine).mockRejectedValue(new ApiError(403, 'PA recovery requires an authorized staff account'))
  await openVerification('existing_pa')
  fireEvent.change(screen.getByLabelText('Verified PA number'), { target: { value: 'PA-9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit verification' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission'))
  expect(gen.verifyPaLine).toHaveBeenCalledTimes(1)
  expect(gen.generatePharmacyPa).not.toHaveBeenCalled()
  expect(screen.queryByText('Confirmed submitted')).not.toBeInTheDocument()
})

it('does not retry a stale verification 409', async () => {
  vi.mocked(orders.getOrder).mockResolvedValue({ order: verifyingOrder(), bids: [], status: 'completed' })
  vi.mocked(gen.verifyPaLine).mockRejectedValue(new ApiError(409, 'This PA line is not awaiting verification'))
  await openVerification('existing_pa')
  fireEvent.change(screen.getByLabelText('Verified PA number'), { target: { value: 'PA-9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit verification' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/changed|no longer available/i))
  expect(gen.verifyPaLine).toHaveBeenCalledTimes(1)
  expect(gen.generatePharmacyPa).not.toHaveBeenCalled()
  expect(screen.queryByText('Confirmed submitted')).not.toBeInTheDocument()
})

it('does not treat an uncertain verification as generated', async () => {
  vi.mocked(orders.getOrder).mockResolvedValue({ order: verifyingOrder(), bids: [], status: 'completed' })
  vi.mocked(gen.verifyPaLine).mockRejectedValue(new ApiError(502, 'down'))
  await openVerification('existing_pa')
  fireEvent.change(screen.getByLabelText('Verified PA number'), { target: { value: 'PA-9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit verification' }))
  await waitFor(() => expect(screen.getByText(/outcome is unknown/i)).toBeInTheDocument())
  expect(gen.verifyPaLine).toHaveBeenCalledTimes(1)
  expect(gen.generatePharmacyPa).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Generate PA' })).toBeDisabled()
  expect(screen.queryByText('Confirmed submitted')).not.toBeInTheDocument()
})
