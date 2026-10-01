import { clsx } from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { IconType } from 'react-icons'
import { LuLayoutDashboard, LuLogOut } from 'react-icons/lu'

import { auditItems, type NavItem, navItems } from '@/constants/navigation'
import { supabase } from '@/lib/supabase'

import { ThemeToggle } from './ThemeToggle'

interface NavRowProps {
  icon: IconType
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}

/** The one row of the Sidebar and the MobileMenu: a nav link, or a button such as Sign out. */
export function NavRow({ icon: Icon, label, href, active = false, onClick }: NavRowProps) {
  const className = clsx(
    'rounded-field flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
    active ? 'bg-primary text-primary-content' : 'text-base-content hover:bg-base-300'
  )
  const content = (
    <>
      <Icon className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={className}
        aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

/** The page links of the Sidebar and the MobileMenu, so a phone reaches every page a desktop does. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useRouter()
  const row = (item: NavItem) => (
    <NavRow
      key={item.href}
      href={item.href}
      icon={item.icon}
      label={item.label}
      active={pathname === item.href}
      onClick={onNavigate}
    />
  )

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {navItems.map(row)}
      <div className="text-base-content/70 text-meta !mt-4 mb-1 px-3 font-semibold">Audit</div>
      {auditItems.map(row)}
    </nav>
  )
}

/** The brand link at the top of the Sidebar and the MobileMenu. */
export function NavBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
      <LuLayoutDashboard className="text-base-content/70 h-6 w-6" aria-hidden />
      <span className="text-lg font-bold">docs.plus</span>
      <span className="badge badge-sm badge-primary">Admin</span>
    </Link>
  )
}

/** The Theme row and the Sign out row at the foot of the Sidebar and the MobileMenu. */
export function NavFooter() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="border-base-300 space-y-2 border-t p-4">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-base-content/70 text-sm">Theme</span>
        <ThemeToggle />
      </div>

      <NavRow icon={LuLogOut} label="Sign out" onClick={handleSignOut} />
    </div>
  )
}
