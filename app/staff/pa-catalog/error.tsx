'use client'
export default function CatalogErrorPage({ reset }: { reset: () => void }) {
  return <div className="p-6" role="alert"><p>Catalog administration is unavailable. No catalog was trusted and no PA was submitted.</p><button onClick={reset}>Reload workspace</button></div>
}
