'use client'
export default function PreparationErrorPage({ reset }: { reset: () => void }) { return <div className="p-6" role="alert"><p>The preparation workspace is unavailable. No PA was submitted.</p><button onClick={reset}>Reload workspace</button></div> }
