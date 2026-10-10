import { FloatingTree } from '@floating-ui/react'
import { useProfileSync } from '@hooks/useProfileSync'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getRoutePolicy } from '@utils/routePolicy'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'

// The gallery is closed at load, so its code loads after hydration. Accepted gap: it has no
// loader, so a failed chunk leaves the gallery unopenable. An error card here would show on
// every pad.
const ChatMediaGallery = dynamic(
  () =>
    import('@components/chatroom/components/ChatMediaGallery').then(
      (module) => module.ChatMediaGallery
    ),
  { ssr: false }
)

// Inside the provider but outside the document shell, because it runs on every route.
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
      {documentShell ? (
        <>
          <ChatMediaGallery />
          <FloatingTree>{children}</FloatingTree>
        </>
      ) : (
        children
      )}
    </QueryClientProvider>
  )
}
