import { clsx } from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { LuLayoutDashboard, LuLogOut } from 'react-icons/lu'

import { navItems } from '@/constants/navigation'
import { supabase } from '@/lib/supabase'

import { ThemeToggle } from './ThemeToggle'

export function Sidebar() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="bg-base-200 border-base-300 sticky top-0 flex h-screen w-64 flex-col border-r">
      {/* Logo */}
      <div className="border-base-300 border-b p-4">
        <Link href="/" className="flex items-center gap-2">
          <LuLayoutDashboard className="text-primary h-6 w-6" />
          <span className="text-lg font-bold">docs.plus</span>
          <span className="badge badge-sm badge-primary">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive = router.pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300 text-base-content'
              )}>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-base-300 space-y-2 border-t p-4">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-base-content/60 text-sm">Theme</span>
          <ThemeToggle />
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="hover:bg-base-300 text-base-content flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors">
          <LuLogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
