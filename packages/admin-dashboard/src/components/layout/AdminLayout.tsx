import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileMenu } from './MobileMenu';
import { useUIStore } from '@/stores/uiStore';
import { LuMenu } from 'react-icons/lu';
import { ThemeToggle } from './ThemeToggle';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { theme } = useUIStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="flex min-h-screen bg-base-100">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-base-300 bg-base-100">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Open menu"
          >
            <LuMenu className="h-5 w-5" />
          </button>
          <span className="font-bold">docs.plus Admin</span>
          <ThemeToggle />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
