'use client'
import { FormEvent, type ReactNode } from 'react'

export function SetupCard({
  title,
  children,
  onSubmit,
  error,
  loading,
  submitLabel,
}: {
  title: string
  children: ReactNode
  onSubmit: (e: FormEvent) => void
  error: string
  loading: boolean
  submitLabel: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-[480px] bg-surface-lowest border border-outline-variant rounded p-8">
        <p className="text-label-caps text-on-surface-variant uppercase tracking-widest mb-2">Pharmacy Dispatch</p>
        <h1 className="text-headline-lg font-semibold text-on-surface mb-2">{title}</h1>
        <p className="text-body-sm text-on-surface-variant mb-6">Complete this step before accessing orders.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          {error && <p role="alert" className="text-body-sm text-error bg-error/10 rounded px-3 py-2">{error}</p>}
          <button disabled={loading} className="w-full bg-primary text-on-primary py-2.5 rounded font-semibold disabled:opacity-60">
            {loading ? 'Saving…' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
