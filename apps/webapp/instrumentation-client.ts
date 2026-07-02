import * as Sentry from '@sentry/nextjs'

import { CHUNK_ERROR_PATTERNS } from './src/utils/chunkErrorPatterns'
import { isChunkRecoveryExhausted } from './src/utils/chunkLoadRecovery'

// iOS Safari emits SW-lifecycle errors during an update check (network blip / browser
// SW bug) with no app-side fix; chunk-load failures are auto-recovered by
// installChunkLoadRecovery. Drop both so the dashboard surfaces real bugs, not
// transient browser/PWA deploy-boundary noise. Chunk patterns are shared with the
// recovery listener so the two never drift.
const SW_LIFECYCLE_PATTERNS: readonly RegExp[] = [
  /Failed to update a ServiceWorker/i,
  /\/sw\.js load failed/i,
  /\/service-worker\.js load failed/i,
  /\/workbox-[^/]+\.js load failed/i
]

const isNonActionable = (event: Sentry.Event): boolean => {
  const message = event.exception?.values?.[0]?.value
  if (!message) return false
  if (SW_LIFECYCLE_PATTERNS.some((re) => re.test(message))) return true
  // Chunk errors are auto-recovered by reload; report only once recovery gave up.
  if (CHUNK_ERROR_PATTERNS.some((re) => re.test(message))) return !isChunkRecoveryExhausted()
  return false
}

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_GIT_HASH || undefined,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.exception && isNonActionable(event)) return null
      return event
    }
  })
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[observability] NEXT_PUBLIC_GLITCHTIP_DSN is unset — client capture is disabled')
}
