'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/staff/intake/new', label: 'New Intake', icon: 'add_circle' },
]

interface StaffShellProps {
  children: React.ReactNode
  userName: string
}

export function StaffShell({ children, userName }: StaffShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await logout().catch(() => {})
    router.push('/staff/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 bg-primary flex flex-col">
        <div className="px-6 py-5 border-b border-primary-container">
          <p className="text-on-primary/60 text-label-caps uppercase tracking-widest mb-0.5">Clearline HMO</p>
          <p className="text-on-primary text-title-md font-semibold">Pharmacy Portal</p>
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
          <p className="text-on-primary/60 text-body-sm mb-1 truncate">{userName}</p>
          <button
            onClick={handleLogout}
            className="text-on-primary/60 hover:text-on-primary text-body-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-surface">
        {children}
      </main>
    </div>
  )
}
