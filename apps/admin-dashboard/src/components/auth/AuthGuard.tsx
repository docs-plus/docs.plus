import { useRouter } from 'next/router'

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
    return (
      <div role="status" className="bg-base-200 flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  // Not admin - redirect is handled by hook, show nothing
  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
