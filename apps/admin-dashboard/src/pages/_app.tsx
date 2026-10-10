import '@/styles/globals.scss'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { type DefaultToastOptions, Toaster } from 'react-hot-toast'

import { Loading } from '@/components/ui/Loading'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false
    }
  }
})

// The toast bar is styled by unlayered goober CSS, which beats Tailwind classes,
// so theme tokens go in inline styles. The vendor shadow stays; it is black-based.
const toastOptions: DefaultToastOptions = {
  style: {
    background: 'var(--color-base-100)',
    color: 'var(--color-base-content)',
    border: '1px solid var(--color-base-300)',
    borderRadius: 'var(--radius-box)'
  },
  success: {
    iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-success-content)' }
  },
  error: {
    iconTheme: { primary: 'var(--color-error)', secondary: 'var(--color-error-content)' }
  },
  loading: {
    iconTheme: { primary: 'var(--color-base-content)', secondary: 'var(--color-base-300)' }
  }
}

// Auth needs the client-side router, so the guard never renders on the server.
const AuthGuard = dynamic(() => import('@/components/auth/AuthGuard'), {
  ssr: false,
  loading: () => <Loading className="bg-base-200 min-h-screen" />
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
      <Toaster position="bottom-right" toastOptions={toastOptions} />
    </QueryClientProvider>
  )
}
