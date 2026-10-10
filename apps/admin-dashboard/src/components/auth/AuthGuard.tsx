import { useRouter } from 'next/router'

import { Loading } from '@/components/ui/Loading'
import { useAdminAuth } from '@/hooks/useAdminAuth'

const publicPages = ['/login', '/unauthorized']

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const { loading, isAdmin } = useAdminAuth()

  if (publicPages.includes(router.pathname)) {
    return <>{children}</>
  }

  if (loading) {
    return <Loading className="bg-base-200 min-h-screen" />
  }

  // Not admin - redirect is handled by hook, show nothing
  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
