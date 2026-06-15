import '@/styles/globals.scss'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false
    }
  }
})

// Auth needs the client-side router, so the guard never renders on the server.
const AuthGuard = dynamic(() => import('@/components/auth/AuthGuard'), {
  ssr: false,
  loading: () => (
    <div className="bg-base-200 flex min-h-screen items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  )
}
