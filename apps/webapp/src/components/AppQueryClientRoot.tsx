import { useProfileSync } from '@hooks/useProfileSync'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getRoutePolicy } from '@utils/routePolicy'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'

// A static import: a next/dynamic shell is not preloaded before hydration under Turbopack,
// so the client's first render missed the server's pad skeleton. The shell is light now.
import { DocumentShellInner } from './DocumentShellInner'

// Inside the provider but above DocumentShellInner, so sync starts with the page.
function ProfileSync() {
  useProfileSync()
  return null
}

interface AppQueryClientRootProps {
  children: ReactNode
  queryClient: QueryClient
}

export function AppQueryClientRoot({ children, queryClient }: AppQueryClientRootProps) {
  const router = useRouter()
  const { documentShell } = getRoutePolicy(router.pathname)

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileSync />
      {documentShell ? <DocumentShellInner>{children}</DocumentShellInner> : children}
    </QueryClientProvider>
  )
}
