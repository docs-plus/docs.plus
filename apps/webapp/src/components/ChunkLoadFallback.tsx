import { EmptyState } from '@components/ui/EmptyState'
import type { DynamicOptionsLoadingProps } from 'next/dynamic'
import type { ReactNode } from 'react'

interface ChunkLoadFallbackProps extends DynamicOptionsLoadingProps {
  skeleton: ReactNode
  /** Goes to the error state only, for example to put it on a surface that differs from the panel. */
  className?: string
}

/**
 * The `loading` view of a next/dynamic chunk. Offline, or after chunk recovery gives up, the
 * skeleton would stay forever. `retry` puts the chunk back in loading, so the skeleton returns.
 * The page-level `ChunkLoadError` in `pages/[...slugs].tsx` stays separate: it reloads the page.
 */
export function ChunkLoadFallback({ error, retry, skeleton, className }: ChunkLoadFallbackProps) {
  if (!error) return skeleton
  return (
    <EmptyState
      tone="error"
      title="Couldn’t load this part."
      body="Check your connection, then try again."
      onRetry={retry ?? (() => window.location.reload())}
      className={className}
    />
  )
}
