'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/api'
import { paNavigation, type PaPermission } from '@/lib/pa-permissions'

const NAV_ITEMS = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/staff/intake/new', label: 'New Intake', icon: 'add_circle' },
  { href: '/staff/pa-generation', label: 'PA Generation', icon: 'prescriptions' },
  { href: '/staff/request-export', label: 'PA Export', icon: 'download' },
]

const PA_LINKS = {
  preparation: '/staff/pa-preparation',
  'mapping-transfer': '/staff/pa-mapping-review',
  'mapping-proposals': '/staff/pa-mapping-proposals',
  catalog: '/staff/pa-catalog',
} as const

interface StaffShellProps {
  children: React.ReactNode
  userName: string
  permissions?: readonly PaPermission[]
}

export function StaffShell({ children, userName, permissions = [] }: StaffShellProps) {
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
          {paNavigation(permissions).map(item => (
            item.key in PA_LINKS ? <Link key={item.key} href={PA_LINKS[item.key as keyof typeof PA_LINKS]} aria-current={pathname.startsWith(PA_LINKS[item.key as keyof typeof PA_LINKS]) ? 'page' : undefined} className="block px-6 py-3 text-on-primary text-body-lg">{item.label}</Link> : <span key={item.key} aria-disabled="true" className="block px-6 py-3 text-on-primary/60 text-body-lg"
              title="Available in a later frontend phase">
              {item.label} <span className="text-body-sm">(coming soon)</span>
            </span>
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
