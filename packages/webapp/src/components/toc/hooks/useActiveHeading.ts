import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

/**
 * Hook to track the currently active heading from URL
 */
export function useActiveHeading(): [string | null, (id: string | null) => void] {
  const router = useRouter()
  const [activeHeading, setActiveHeading] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const headingId = url.searchParams.get('id')
    if (headingId) setActiveHeading(headingId)
  }, [router.asPath])

  return [activeHeading, setActiveHeading]
}
