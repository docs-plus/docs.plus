import { useRouter } from 'next/router'

import { useAdminAuth } from '@/hooks/useAdminAuth'

// Pages that don't require auth
const publicPages = ['/login', '/unauthorized']

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const { loading, isAdmin } = useAdminAuth()

  // Public pages don't need auth - render immediately
  if (publicPages.includes(router.pathname)) {
    return <>{children}</>
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="bg-base-200 flex min-h-screen items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/60 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  // Not admin - redirect is handled by hook, show nothing
  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
