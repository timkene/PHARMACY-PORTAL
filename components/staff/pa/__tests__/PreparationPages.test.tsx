import { expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getStaffSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PreparationPage from '@/app/staff/pa-preparation/page'
import BatchPage from '@/app/staff/pa-preparation/[batchId]/page'
vi.mock('@/lib/auth', () => ({ getStaffSession: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT') }), usePathname: () => '/staff/pa-preparation', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../BatchWorkspace', () => ({ BatchWorkspace: () => <p>AUTHORIZED_WORKSPACE</p> }))
vi.mock('../PreparationList', () => ({ PreparationList: () => <p>AUTHENTICATED_LIST</p> }))
beforeEach(() => vi.clearAllMocks())
it.each(['list', 'detail'])('redirects unauthenticated %s requests', async route => {
  vi.mocked(getStaffSession).mockResolvedValue(null)
  await expect(route === 'list' ? PreparationPage() : BatchPage({ params: Promise.resolve({ batchId: 'batch' }) })).rejects.toThrow('REDIRECT')
  expect(redirect).toHaveBeenCalledWith('/staff/login')
})
it('does not mount an arbitrary detail workspace for WRITE-only staff', async () => {
  vi.mocked(getStaffSession).mockResolvedValue({ userId: 'writer', name: 'Writer', email: '', permissions: ['PA_PREPARATION_WRITE'] })
  render(await BatchPage({ params: Promise.resolve({ batchId: 'arbitrary' }) }))
  expect(screen.getByRole('alert')).toHaveTextContent('READ permission is required')
  expect(screen.queryByText('AUTHORIZED_WORKSPACE')).not.toBeInTheDocument()
})
it('mounts detail only with authoritative READ permission', async () => {
  vi.mocked(getStaffSession).mockResolvedValue({ userId: 'reader', name: 'Reader', email: '', permissions: ['PA_PREPARATION_READ'] })
  render(await BatchPage({ params: Promise.resolve({ batchId: 'batch' }) }))
  expect(screen.getByText('AUTHORIZED_WORKSPACE')).toBeInTheDocument()
})
it('lets authenticated WRITE-only staff reach the mutation-only root', async () => {
  vi.mocked(getStaffSession).mockResolvedValue({ userId: 'writer', name: 'Writer', email: '', permissions: ['PA_PREPARATION_WRITE'] })
  render(await PreparationPage())
  expect(screen.getByText('AUTHENTICATED_LIST')).toBeInTheDocument()
})
