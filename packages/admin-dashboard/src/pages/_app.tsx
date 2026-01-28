import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import '@/styles/globals.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

// Pages that don't require auth
const publicPages = ['/login', '/unauthorized'];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isAdmin } = useAdminAuth();

  // Public pages don't need auth
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

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
