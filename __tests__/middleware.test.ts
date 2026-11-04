import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

describe('aggregator public onboarding routes', () => {
  it.each(['/aggregator/forgot-password', '/aggregator/reset-password', '/aggregator/verify-email'])('does not require a session for %s', path => {
    const request = new NextRequest(`http://test.local${path}`)
    expect(middleware(request).status).toBe(200)
  })
})
