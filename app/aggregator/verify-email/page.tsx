'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyAggregatorEmail, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'
import { SetupCard } from '../setup/password/page'

export default function VerifyEmailPage() {
  const router = useRouter(); const [token, setToken] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), [])
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setLoading(true); try { await verifyAggregatorEmail(token); router.push('/aggregator/dashboard') } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to verify email') } finally { setLoading(false) } }
  return <SetupCard title="Verify your email" onSubmit={submit} error={error} loading={loading} submitLabel="Verify email"><label>Verification code or token<input className={INPUT_CLS} required value={token} onChange={e => setToken(e.target.value)} autoComplete="one-time-code" /></label></SetupCard>
}
