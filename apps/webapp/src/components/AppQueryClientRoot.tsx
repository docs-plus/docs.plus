import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getRoutePolicy } from '@utils/routePolicy'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'

const DocumentShellInner = dynamic(
  () => import('./DocumentShellInner').then((module) => module.DocumentShellInner),
  { ssr: false }
)

interface AppQueryClientRootProps {
  children: ReactNode
  queryClient: QueryClient
}

export function AppQueryClientRoot({ children, queryClient }: AppQueryClientRootProps) {
  const router = useRouter()
  const { documentShell } = getRoutePolicy(router.pathname)

  return (
    <QueryClientProvider client={queryClient}>
      {documentShell ? <DocumentShellInner>{children}</DocumentShellInner> : children}
    </QueryClientProvider>
  )
}
