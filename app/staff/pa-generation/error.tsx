'use client'
export default function PaGenerationErrorPage({ reset }: { reset: () => void }) {
  return <div className="p-6" role="alert"><p>PA generation is unavailable. The last result may be unknown; no automatic retry was sent.</p><button onClick={reset}>Reload workspace</button></div>
}
