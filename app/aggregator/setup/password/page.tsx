'use client'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeAggregatorPassword, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'
import { SetupCard } from '@/components/aggregator/SetupCard'

export default function AggregatorPasswordSetupPage() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (next !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try { await changeAggregatorPassword(current, next); router.push('/aggregator/setup/email') }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to change password') }
    finally { setLoading(false) }
  }
  return <SetupCard title="Set your password" onSubmit={submit} error={error} loading={loading} submitLabel="Continue">
    <label>Current password<input className={INPUT_CLS} type="password" required value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" /></label>
    <label>New password<input className={INPUT_CLS} type="password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" /></label>
    <label>Confirm new password<input className={INPUT_CLS} type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></label>
  </SetupCard>
}
