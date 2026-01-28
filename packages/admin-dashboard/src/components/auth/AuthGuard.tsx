import { useRouter } from 'next/router';
import { useAdminAuth } from '@/hooks/useAdminAuth';

// Pages that don't require auth
const publicPages = ['/login', '/unauthorized'];

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { loading, isAdmin } = useAdminAuth();

  // Public pages don't need auth - render immediately
  if (publicPages.includes(router.pathname)) {
    return <>{children}</>;
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-base-content/60">Loading...</p>
        </div>
      </div>
    );
  }

  // Not admin - redirect is handled by hook, show nothing
  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}

