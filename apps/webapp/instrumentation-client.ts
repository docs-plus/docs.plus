import * as Sentry from '@sentry/nextjs'

import { sentryDataCollection } from './sentryDataCollection'
import { matchesChunkError } from './src/utils/chunkErrorPatterns'
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
  /\/workbox-[^/]+\.js load failed/i,
  // next-pwa's injected register.js calls register() and cache.add() with no catch.
  /Failed to register a ServiceWorker/i,
  /Failed to execute 'add' on 'Cache'/i
]

// One Safari IndexedDB fault (#751, GlitchTip 197 and 200) sent hundreds of events per
// trace. Keep the first per page load as a warning, so counts stay usable. No fingerprint,
// so it stays in 197 and 200. Remove once #751 has 7 clean days.
const IDB_INACTIVE_PATTERNS: readonly RegExp[] = [
  /Attempt to generate key in database without an in-progress transaction/,
  /Attempt to get records from database without an in-progress transaction/
]
let idbInactiveReported = false

// Sentry lists linked causes first and the thrown error last, so test every value.
const exceptionValues = (event: Sentry.Event): string[] =>
  (event.exception?.values ?? []).map((ex) => ex.value ?? '').filter(Boolean)

const matchesAny = (values: string[], patterns: readonly RegExp[]): boolean =>
  values.some((value) => patterns.some((re) => re.test(value)))

const isNonActionable = (values: string[]): boolean => {
  if (matchesAny(values, SW_LIFECYCLE_PATTERNS)) return true
  // Chunk errors are auto-recovered by reload; report only once recovery gave up.
  if (values.some(matchesChunkError)) return !isChunkRecoveryExhausted()
  return false
}

const throttleIdbInactive = (event: Sentry.Event, values: string[]): boolean => {
  if (!matchesAny(values, IDB_INACTIVE_PATTERNS)) return false
  if (idbInactiveReported) return true
  idbInactiveReported = true
  event.level = 'warning'
  return false
}

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_GIT_HASH || undefined,
    tracesSampleRate: 0,
    dataCollection: sentryDataCollection,
    beforeSend(event) {
      const values = exceptionValues(event)
      if (throttleIdbInactive(event, values) || isNonActionable(values)) return null
      return event
    }
  })
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[observability] NEXT_PUBLIC_GLITCHTIP_DSN is unset — client capture is disabled')
}
