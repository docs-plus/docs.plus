import { useProfileSync } from '@hooks/useProfileSync'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getRoutePolicy } from '@utils/routePolicy'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'

// A split chunk keeps the shell out of the landing bundle. It still renders on the
// server, so the pad skeleton is in the first HTML (Skeleton doctrine).
const DocumentShellInner = dynamic(() =>
  import('./DocumentShellInner').then((module) => module.DocumentShellInner)
)

// Inside the provider but above the lazy DocumentShellInner, so sync starts with the page.
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
