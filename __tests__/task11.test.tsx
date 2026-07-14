import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// --- Mocks ---

const mockPush = vi.fn()
const mockPathname = vi.fn(() => '/aggregator/dashboard')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}))

const mockLogout = vi.fn()
const mockAggregatorSignup = vi.fn()
const mockAggregatorLogin = vi.fn()

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }
  return {
    logout: (...args: unknown[]) => mockLogout(...args),
    aggregatorSignup: (...args: unknown[]) => mockAggregatorSignup(...args),
    aggregatorLogin: (...args: unknown[]) => mockAggregatorLogin(...args),
    ApiError,
  }
})

// Import after mocks are set up
import { AggregatorShell } from '@/components/aggregator/AggregatorShell'
import AggregatorSignupPage from '@/app/aggregator/signup/page'
import AggregatorLoginPage from '@/app/aggregator/login/page'
import { ApiError } from '@/lib/api'

// -------------------------
// AggregatorShell tests
// -------------------------
describe('AggregatorShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue('/aggregator/dashboard')
  })

  it('renders company name in sidebar', () => {
    render(<AggregatorShell companyName="MedStore Nigeria">content</AggregatorShell>)
    expect(screen.getByText('MedStore Nigeria')).toBeInTheDocument()
  })

  it('renders Dashboard nav link', () => {
    render(<AggregatorShell companyName="TestCo">content</AggregatorShell>)
    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/aggregator/dashboard')
  })

  it('active link gets bg-primary-container class when pathname matches', () => {
    mockPathname.mockReturnValue('/aggregator/dashboard')
    render(<AggregatorShell companyName="TestCo">content</AggregatorShell>)
    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link.className).toContain('bg-primary-container')
  })

  it('sign out button calls logout then pushes to /aggregator/login', async () => {
    mockLogout.mockResolvedValue(undefined)
    render(<AggregatorShell companyName="TestCo">content</AggregatorShell>)
    fireEvent.click(screen.getByText('Sign out'))
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledOnce()
      expect(mockPush).toHaveBeenCalledWith('/aggregator/login')
    })
  })
})

// -------------------------
// AggregatorSignupPage tests
// -------------------------
describe('AggregatorSignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 6 input fields', () => {
    render(<AggregatorSignupPage />)
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contact full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    // Two password fields
    const passwordFields = screen.getAllByLabelText(/password/i)
    expect(passwordFields).toHaveLength(2)
  })

  it('shows "Passwords do not match" error when passwords differ without calling API', async () => {
    render(<AggregatorSignupPage />)

    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'TestCo' } })
    fireEvent.change(screen.getByLabelText(/contact full name/i), { target: { value: 'John Doe' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'john@test.com' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+2348000000000' } })

    const [passwordField, confirmField] = screen.getAllByLabelText(/password/i)
    fireEvent.change(passwordField, { target: { value: 'password123' } })
    fireEvent.change(confirmField, { target: { value: 'different456' } })

    // Check the T&C checkbox
    fireEvent.click(screen.getByRole('checkbox'))

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
    })
    expect(mockAggregatorSignup).not.toHaveBeenCalled()
  })

  it('calls aggregatorSignup with correct payload and redirects on success', async () => {
    mockAggregatorSignup.mockResolvedValue({ user: { id: '1', companyName: 'TestCo' } })
    render(<AggregatorSignupPage />)

    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'TestCo' } })
    fireEvent.change(screen.getByLabelText(/contact full name/i), { target: { value: 'John Doe' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'john@test.com' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+2348000000000' } })

    const [passwordField, confirmField] = screen.getAllByLabelText(/password/i)
    fireEvent.change(passwordField, { target: { value: 'secret123' } })
    fireEvent.change(confirmField, { target: { value: 'secret123' } })

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockAggregatorSignup).toHaveBeenCalledWith({
        companyName: 'TestCo',
        contactName: 'John Doe',
        email: 'john@test.com',
        phone: '+2348000000000',
        password: 'secret123',
      })
      expect(mockPush).toHaveBeenCalledWith('/aggregator/dashboard')
    })
  })

  it('shows ApiError message on failure', async () => {
    mockAggregatorSignup.mockRejectedValue(new ApiError(400, 'Email already registered'))
    render(<AggregatorSignupPage />)

    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'TestCo' } })
    fireEvent.change(screen.getByLabelText(/contact full name/i), { target: { value: 'John Doe' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'john@test.com' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+2348000000000' } })

    const [passwordField, confirmField] = screen.getAllByLabelText(/password/i)
    fireEvent.change(passwordField, { target: { value: 'secret123' } })
    fireEvent.change(confirmField, { target: { value: 'secret123' } })

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered')
    })
  })

  it('submit button is disabled when T&C checkbox is not checked', () => {
    render(<AggregatorSignupPage />)
    const button = screen.getByRole('button', { name: /create account/i })
    expect(button).toBeDisabled()
  })
})

// -------------------------
// AggregatorLoginPage tests
// -------------------------
describe('AggregatorLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password inputs', () => {
    render(<AggregatorLoginPage />)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('calls aggregatorLogin(email, password) on submit', async () => {
    mockAggregatorLogin.mockResolvedValue({ user: { id: '1' } })
    render(<AggregatorLoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockAggregatorLogin).toHaveBeenCalledWith('user@test.com', 'mypassword')
    })
  })

  it('redirects to /aggregator/dashboard on success', async () => {
    mockAggregatorLogin.mockResolvedValue({ user: { id: '1' } })
    render(<AggregatorLoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/aggregator/dashboard')
    })
  })

  it('shows "Invalid email or password" on ApiError', async () => {
    mockAggregatorLogin.mockRejectedValue(new ApiError(401, 'Unauthorized'))
    render(<AggregatorLoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
    })
  })

  it('shows "Something went wrong" on non-ApiError', async () => {
    mockAggregatorLogin.mockRejectedValue(new Error('Network error'))
    render(<AggregatorLoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@test.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    })
  })
})
