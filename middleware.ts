import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { STAFF_SESSION_COOKIE, AGGREGATOR_SESSION_COOKIE } from './lib/constants'

const PUBLIC_PATHS = [
  '/staff/login',
  '/aggregator/login',
  '/aggregator/signup',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/staff')) {
    if (!request.cookies.get(STAFF_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }
  }

  if (pathname.startsWith('/aggregator')) {
    if (!request.cookies.get(AGGREGATOR_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL('/aggregator/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/staff/:path*', '/aggregator/:path*'],
}
