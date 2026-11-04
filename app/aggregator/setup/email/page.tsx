'use client'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setAggregatorEmail, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'
import { SetupCard } from '../password/page'

export default function AggregatorEmailSetupPage() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setLoading(true); try { await setAggregatorEmail(email); router.push(`/aggregator/verify-email?email=${encodeURIComponent(email)}`) } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to update email') } finally { setLoading(false) } }
  return <SetupCard title="Add your email" onSubmit={submit} error={error} loading={loading} submitLabel="Send verification"><label>Email address<input className={INPUT_CLS} type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label></SetupCard>
}
