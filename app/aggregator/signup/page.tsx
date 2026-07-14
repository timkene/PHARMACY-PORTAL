'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { aggregatorSignup, ApiError } from '@/lib/api'

const INPUT_CLS = 'w-full border border-outline-variant rounded px-3 py-2 text-body-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

const FIELDS = [
  { label: 'Company Name', field: 'companyName' as const, type: 'text', placeholder: 'MedStore Nigeria Ltd' },
  { label: 'Contact Full Name', field: 'contactName' as const, type: 'text', placeholder: 'John Adeyemi' },
  { label: 'Email Address', field: 'email' as const, type: 'email', placeholder: 'contact@medstore.ng' },
  { label: 'Phone Number', field: 'phone' as const, type: 'tel', placeholder: '+234 800 000 0000' },
  { label: 'Password', field: 'password' as const, type: 'password', placeholder: '' },
  { label: 'Confirm Password', field: 'confirmPassword' as const, type: 'password', placeholder: '' },
]

export default function AggregatorSignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', phone: '', password: '', confirmPassword: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setError('')
    setLoading(true)
    try {
      await aggregatorSignup({
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      })
      router.push('/aggregator/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-[520px] bg-surface-lowest border border-outline-variant rounded p-8">
        <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Pharmacy Dispatch</p>
        <h1 className="text-headline-lg font-semibold text-on-surface mb-6">Create Aggregator Account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELDS.map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label htmlFor={field} className="block text-body-sm font-semibold mb-1">{label}</label>
              <input
                id={field}
                required
                type={type}
                className={INPUT_CLS}
                placeholder={placeholder}
                value={form[field]}
                onChange={update(field)}
                autoComplete={field === 'password' || field === 'confirmPassword' ? 'new-password' : undefined}
              />
            </div>
          ))}

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required className="mt-1" />
            <span className="text-body-sm text-on-surface-variant">
              I agree to the terms and conditions of the Clearline HMO pharmacy dispatch program.
            </span>
          </label>

          {error && <p role="alert" className="text-body-sm text-error bg-error/10 rounded px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 rounded font-semibold text-body-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-body-sm text-on-surface-variant text-center mt-4">
          Already registered?{' '}
          <Link href="/aggregator/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
