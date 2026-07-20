'use client'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { staffLogin, ApiError } from '@/lib/api'

const INPUT_CLS = 'w-full border border-outline-variant rounded px-3 py-2 text-body-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

export default function StaffLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await staffLogin(email, password)
      router.push('/staff/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? 'Invalid email or password' : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-[480px] bg-surface-lowest border border-outline-variant rounded p-8">
        <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Clearline HMO</p>
        <h1 className="text-headline-lg font-semibold text-on-surface mb-6">Staff Sign In</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-body-sm font-semibold text-on-surface mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={INPUT_CLS}
              placeholder="staff@clearline.com"
            />
          </div>

          <div>
            <label className="block text-body-sm font-semibold text-on-surface mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={INPUT_CLS + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-body-sm text-error bg-error/10 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 rounded font-semibold text-body-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
