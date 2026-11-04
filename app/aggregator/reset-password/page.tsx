'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetAggregatorPassword, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'

export default function ResetPasswordPage() {
  const router = useRouter(); const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), [])
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); if (password !== confirm) { setError('Passwords do not match'); return } setLoading(true); try { await resetAggregatorPassword(token, password); router.push('/aggregator/login') } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to reset password') } finally { setLoading(false) } }
  return <div className="min-h-screen flex items-center justify-center bg-surface p-4"><div className="w-full max-w-[480px] bg-surface-lowest border border-outline-variant rounded p-8"><h1 className="text-headline-lg font-semibold mb-6">Reset password</h1><form onSubmit={submit} className="space-y-4"><label>New password<input className={INPUT_CLS} type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label><label>Confirm new password<input className={INPUT_CLS} type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></label>{error && <p role="alert" className="text-error text-body-sm">{error}</p>}<button disabled={loading || !token} className="w-full bg-primary text-on-primary py-2.5 rounded font-semibold">{loading ? 'Saving…' : 'Reset password'}</button></form></div></div>
}
