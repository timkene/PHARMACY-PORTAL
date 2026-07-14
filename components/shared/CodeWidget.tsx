'use client'
import { useState } from 'react'

interface CodeWidgetProps {
  code: string
  label?: string
}

export function CodeWidget({ code, label = 'ACTIVE & SECURE' }: CodeWidgetProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-primary rounded p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-on-primary/60 text-label-caps uppercase tracking-widest mb-1">{label}</p>
        <p className="font-mono text-code-mono text-on-primary tracking-[0.15em]">{code}</p>
      </div>
      <button
        onClick={copy}
        className="shrink-0 bg-primary-container hover:bg-primary-container/80 text-on-primary px-3 py-1.5 rounded text-body-sm transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
