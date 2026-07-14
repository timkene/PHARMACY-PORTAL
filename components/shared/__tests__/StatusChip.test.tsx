import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusChip } from '../StatusChip'

describe('StatusChip', () => {
  it('renders label text', () => {
    render(<StatusChip status="active" label="Active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('applies green styling for active status', () => {
    const { container } = render(<StatusChip status="active" label="Active" />)
    expect(container.firstChild).toHaveClass('text-secondary')
  })

  it('applies red styling for error status', () => {
    const { container } = render(<StatusChip status="error" label="Failed" />)
    expect(container.firstChild).toHaveClass('text-error')
  })

  it('applies amber styling for pending status', () => {
    const { container } = render(<StatusChip status="pending" label="Pending" />)
    expect(container.firstChild).toHaveClass('text-amber-700')
  })
})
