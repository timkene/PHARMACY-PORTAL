'use client'
export default function RequestExportError({ reset }: { reset: () => void }) {
  return <div className="p-6" role="alert"><p>PA request export is unavailable.</p><button onClick={reset}>Reload</button></div>
}
