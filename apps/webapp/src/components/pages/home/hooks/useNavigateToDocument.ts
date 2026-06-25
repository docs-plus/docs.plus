import * as toast from '@components/toast'
import { ensureAnonymousSession } from '@utils/ensureAnonymousSession'
import { sanitizeDocumentSlug } from '@utils/sanitizeDocumentSlug'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'

function prefetchDocumentShell() {
  void import('@components/DocumentShellInner')
}

export function useNavigateToDocument() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handleComplete = () => setIsLoading(false)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)
    return () => {
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  }, [router.events])

  const navigateToDocument = useCallback(
    async (name?: string) => {
      setIsLoading(true)
      prefetchDocumentShell()
      const slug = sanitizeDocumentSlug(name)
      try {
        await ensureAnonymousSession()
        await router.push(`/${slug}`)
      } catch (err) {
        console.warn('Failed to open document:', err)
        toast.Error('Could not open the document. Please try again.')
        setIsLoading(false)
      }
    },
    [router]
  )

  return { navigateToDocument, isLoading }
}

export { prefetchDocumentShell }
