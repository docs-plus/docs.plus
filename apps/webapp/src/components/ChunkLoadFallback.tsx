import { EmptyState } from '@components/ui/EmptyState'
import type { DynamicOptionsLoadingProps } from 'next/dynamic'
import type { ReactNode } from 'react'

interface ChunkLoadFallbackProps extends DynamicOptionsLoadingProps {
  skeleton: ReactNode
  /** Goes to the error state only, for example to put it on a surface that differs from the panel. */
  className?: string
}

// Keyed on `retry`, which next/dynamic keeps stable per chunk. A component flag would reset
// whenever a caller (the Settings takeover) moves this view to a new parent between states.
const retriedChunks = new WeakSet<() => void>()

/**
 * The `loading` view of a next/dynamic chunk. Offline, or after chunk recovery gives up, the
 * skeleton would stay forever. The first Try again retries in place. A bundler that caches the
 * failed chunk (Turbopack) fails again at once, so the next press reloads the page.
 */
export function ChunkLoadFallback({ error, retry, skeleton, className }: ChunkLoadFallbackProps) {
  if (!error) return skeleton
  const onRetry =
    retry && !retriedChunks.has(retry)
      ? () => {
          retriedChunks.add(retry)
          retry()
        }
      : () => window.location.reload()
  return (
    <EmptyState
      tone="error"
      title="Couldn’t load this part."
      body="Check your connection, then try again."
      onRetry={onRetry}
      className={className}
    />
  )
}
