'use client'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { forgotAggregatorPassword, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setLoading(true); try { await forgotAggregatorPassword(identifier.trim()); setSent(true) } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to submit request') } finally { setLoading(false) } }
  return <div className="min-h-screen flex items-center justify-center bg-surface p-4"><div className="w-full max-w-[480px] bg-surface-lowest border border-outline-variant rounded p-8"><h1 className="text-headline-lg font-semibold mb-2">Forgot password?</h1>{sent ? <p role="status" className="text-body-md">If an account matches, you’ll receive reset instructions shortly.</p> : <form onSubmit={submit} className="space-y-4"><label>Username or email<input className={INPUT_CLS} required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="benson pharmacy" /></label>{error && <p role="alert" className="text-error text-body-sm">{error}</p>}<button disabled={loading} className="w-full bg-primary text-on-primary py-2.5 rounded font-semibold">{loading ? 'Sending…' : 'Send reset instructions'}</button></form>}<Link href="/aggregator/login" className="block mt-5 text-primary text-body-sm hover:underline">Back to sign in</Link></div></div>
}
