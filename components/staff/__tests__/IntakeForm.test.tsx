import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntakeForm } from '../IntakeForm'

// Synthetic selections keep intake regression tests independent of live search services.
vi.mock('@/lib/api', () => ({
  searchMembers: vi.fn(), searchProviders: vi.fn(), searchProcedures: vi.fn(), searchDiagnoses: vi.fn(),
  getMemberDetail: vi.fn().mockResolvedValue({ phone: '000', address: 'Synthetic address' }),
}))
vi.mock('@/components/shared/SearchComboBox', () => ({
  SearchComboBox: ({ placeholder, onSelect }: { placeholder: string; onSelect: (r: { code: string; label: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ code: 'SYNTHETIC', label: placeholder })}>{placeholder}</button>
  ),
}))

async function selectPatientAndProvider() {
  fireEvent.click(screen.getByText('e.g. CL12345 or Jane Doe'))
  fireEvent.click(screen.getByText("e.g. St. Mary's Hospital"))
  await waitFor(() => expect(screen.getByPlaceholderText('e.g. 08012345678')).toHaveValue('000'))
}

describe('IntakeForm', () => {
  it('shows medication error when submitting with no medications', async () => {
    const onSubmit = vi.fn()
    render(<IntakeForm onSubmit={onSubmit} submitting={false} />)
    await selectPatientAndProvider()
    fireEvent.click(screen.getByText('Submit for Bidding'))
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one medication/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with selected enrollee, provider and medication', async () => {
    const onSubmit = vi.fn()
    render(<IntakeForm onSubmit={onSubmit} submitting={false} />)
    await selectPatientAndProvider()
    fireEvent.click(screen.getByText('Add Line'))
    fireEvent.click(screen.getByText('Search diagnosis…'))
    fireEvent.click(screen.getByText('Search procedure or medication…'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'every 24 hrs' } })
    fireEvent.click(screen.getByText('Submit for Bidding'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      enrollee: expect.objectContaining({ enrolleeId: 'SYNTHETIC', phone: '000' }),
      provider: expect.objectContaining({ providerId: 'SYNTHETIC' }),
      medications: [expect.objectContaining({ procedureCode: 'SYNTHETIC', diagnosisCode: 'SYNTHETIC', frequency: 'every 24 hrs' })],
    }))
  })

  it('disables submit button when submitting prop is true', () => {
    render(<IntakeForm onSubmit={vi.fn()} submitting={true} />)
    expect(screen.getByText('Submitting…').closest('button')).toBeDisabled()
  })
})
