import '@testing-library/jest-dom'
import { beforeEach, vi } from 'vitest'

// Tests must explicitly mock API traffic; never contact prescription or search services.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network disabled in tests')))
})
