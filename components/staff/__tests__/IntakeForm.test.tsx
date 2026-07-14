import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntakeForm } from '../IntakeForm'

describe('IntakeForm', () => {
  it('shows medication error when submitting with no medications', async () => {
    render(<IntakeForm onSubmit={vi.fn()} submitting={false} />)

    // Fill required enrollee fields
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByPlaceholderText('jane@example.com'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('+234 800 000 0000'), { target: { value: '+2348001234567' } })
    fireEvent.change(screen.getByPlaceholderText('123 Main St, Lagos'), { target: { value: '1 Test St' } })
    fireEvent.change(screen.getByPlaceholderText('Diabetes mellitus (E11)'), { target: { value: 'Malaria' } })

    fireEvent.click(screen.getByText('Submit for Bidding'))

    await waitFor(() => {
      expect(screen.getByText(/at least one medication/i)).toBeInTheDocument()
    })
  })

  it('calls onSubmit with correct data when form is valid', async () => {
    const onSubmit = vi.fn()
    render(<IntakeForm onSubmit={onSubmit} submitting={false} />)

    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByPlaceholderText('jane@example.com'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('+234 800 000 0000'), { target: { value: '+2348001234567' } })
    fireEvent.change(screen.getByPlaceholderText('123 Main St, Lagos'), { target: { value: '1 Test St' } })
    fireEvent.change(screen.getByPlaceholderText('Diabetes mellitus (E11)'), { target: { value: 'Malaria' } })

    fireEvent.click(screen.getByText('Add Medication'))
    const nameInput = screen.getByPlaceholderText('Paracetamol')
    fireEvent.change(nameInput, { target: { value: 'Amoxicillin' } })

    fireEvent.click(screen.getByText('Submit for Bidding'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollee: expect.objectContaining({ fullName: 'Test User' }),
          medications: expect.arrayContaining([expect.objectContaining({ name: 'Amoxicillin' })]),
        })
      )
    })
  })

  it('disables submit button when submitting prop is true', () => {
    render(<IntakeForm onSubmit={vi.fn()} submitting={true} />)
    const btn = screen.getByText('Submitting…')
    expect(btn.closest('button')).toBeDisabled()
  })
})
