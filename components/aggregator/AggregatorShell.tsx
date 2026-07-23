'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/api'
import type { ReactNode } from 'react'

const NAV_ITEMS = [
  { href: '/aggregator/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/aggregator/orders',    label: 'Orders',    icon: 'receipt_long' },
]

export function AggregatorShell({ children, companyName }: { children: ReactNode; companyName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await logout().catch(() => {})
    router.push('/aggregator/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[280px] shrink-0 bg-primary flex flex-col">
        <div className="px-6 py-5 border-b border-primary-container">
          <p className="text-on-primary/60 text-label-caps uppercase tracking-widest mb-0.5">Pharmacy Dispatch</p>
          <p className="text-on-primary text-title-md font-semibold">{companyName}</p>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-body-lg transition-colors ${
                pathname.startsWith(item.href)
                  ? 'bg-primary-container text-on-primary'
                  : 'text-on-primary/70 hover:bg-primary-container/50 hover:text-on-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-primary-container">
          <button onClick={handleLogout} className="text-on-primary/60 hover:text-on-primary text-body-sm transition-colors">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-surface">{children}</main>
    </div>
  )
}
