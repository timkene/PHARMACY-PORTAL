'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { aggregatorLogin, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'

export default function AggregatorLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await aggregatorLogin(email, password)
      router.push('/aggregator/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? 'Invalid email or password' : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-[480px] bg-surface-lowest border border-outline-variant rounded p-8">
        <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Pharmacy Dispatch</p>
        <h1 className="text-headline-lg font-semibold text-on-surface mb-6">Aggregator Sign In</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-body-sm font-semibold mb-1">Email Address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={INPUT_CLS}
              placeholder="contact@medstore.ng"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-body-sm font-semibold mb-1">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={INPUT_CLS}
              autoComplete="current-password"
            />
          </div>

          {error && <p role="alert" className="text-body-sm text-error bg-error/10 rounded px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 rounded font-semibold text-body-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-body-sm text-on-surface-variant text-center mt-4">
          New aggregator?{' '}
          <Link href="/aggregator/signup" className="text-primary font-semibold hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  )
}
