import * as Sentry from '@sentry/nextjs'

import { CHUNK_ERROR_PATTERNS } from './src/utils/chunkErrorPatterns'

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

const NON_ACTIONABLE_PATTERNS: readonly RegExp[] = [
  ...SW_LIFECYCLE_PATTERNS,
  ...CHUNK_ERROR_PATTERNS
]

const isNonActionable = (event: Sentry.Event): boolean => {
  const message = event.exception?.values?.[0]?.value
  if (!message) return false
  return NON_ACTIONABLE_PATTERNS.some((re) => re.test(message))
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
}
