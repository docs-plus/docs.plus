import Link from 'next/link';
import { useRouter } from 'next/router';
import { LuLayoutDashboard, LuLogOut, LuX } from 'react-icons/lu';
import { supabase } from '@/lib/supabase';
import { clsx } from 'clsx';
import { ThemeToggle } from './ThemeToggle';
import { navItems } from '@/constants/navigation';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleNavClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Menu */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-base-200 z-50 flex flex-col lg:hidden">
        {/* Header */}
        <div className="p-4 border-b border-base-300 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" onClick={handleNavClick}>
            <LuLayoutDashboard className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">docs.plus</span>
            <span className="badge badge-sm badge-primary">Admin</span>
          </Link>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-square">
            <LuX className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-content'
                    : 'hover:bg-base-300 text-base-content'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 space-y-2">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-base-content/60">Theme</span>
            <ThemeToggle />
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-base-300 text-base-content transition-colors"
          >
            <LuLogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
