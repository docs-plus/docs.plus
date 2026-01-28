import { useEffect, useState } from 'react'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.scss'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false
    }
  }
})

// Lazy load AuthGuard only on client
function ClientAuthGuard({ children }: { children: React.ReactNode }) {
  const [AuthGuard, setAuthGuard] = useState<React.ComponentType<{
    children: React.ReactNode
  }> | null>(null)

  useEffect(() => {
    // Import AuthGuard only on client side
    import('@/components/auth/AuthGuard').then((mod) => {
      setAuthGuard(() => mod.default)
    })
  }, [])

  // Show loading while AuthGuard is being loaded
  if (!AuthGuard) {
    return (
      <div className="bg-base-200 flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  return <AuthGuard>{children}</AuthGuard>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientAuthGuard>
        <Component {...pageProps} />
      </ClientAuthGuard>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  )
}
