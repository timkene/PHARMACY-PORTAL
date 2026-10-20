'use client'
export default function MappingReviewErrorPage({ reset }: { reset: () => void }) { return <div className="p-6" role="alert"><p>The mapping review workspace is unavailable. No mapping was activated and no PA was submitted.</p><button onClick={reset}>Reload workspace</button></div> }
