'use client'
import { FormEvent, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { changeAggregatorPassword, ApiError } from '@/lib/api'
import { INPUT_CLS } from '@/lib/styles'

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

export function SetupCard({ title, children, onSubmit, error, loading, submitLabel }: { title: string; children: ReactNode; onSubmit: (e: FormEvent) => void; error: string; loading: boolean; submitLabel: string }) {
  return <div className="min-h-screen flex items-center justify-center bg-surface p-4"><div className="w-full max-w-[480px] bg-surface-lowest border border-outline-variant rounded p-8"><p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Pharmacy Dispatch</p><h1 className="text-headline-lg font-semibold text-on-surface mb-2">{title}</h1><p className="text-body-sm text-on-surface-variant mb-6">Complete this step before accessing orders.</p><form onSubmit={onSubmit} className="space-y-4">{children}{error && <p role="alert" className="text-body-sm text-error bg-error/10 rounded px-3 py-2">{error}</p>}<button disabled={loading} className="w-full bg-primary text-on-primary py-2.5 rounded font-semibold disabled:opacity-60">{loading ? 'Saving…' : submitLabel}</button></form></div></div>
}
