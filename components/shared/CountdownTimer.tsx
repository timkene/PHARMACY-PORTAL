'use client'
import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  endsAt: string
}

function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSecs / 60).toString().padStart(2, '0')
  const s = (totalSecs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const TWO_MINUTES_MS = 2 * 60 * 1000

export function CountdownTimer({ endsAt }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(endsAt).getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(new Date(endsAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const expired = remaining <= 0
  const isUrgent = remaining < TWO_MINUTES_MS && !expired

  return (
    <span
      className={`font-mono text-display-lg tabular-nums ${
        isUrgent ? 'text-error animate-pulse' : 'text-on-primary'
      }`}
    >
      {expired ? '00:00' : formatTime(remaining)}
    </span>
  )
}
