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

// Sentry lists linked causes first and the thrown error last, so test every value.
const exceptionValues = (event: Sentry.Event): string[] =>
  (event.exception?.values ?? []).map((ex) => ex.value ?? '').filter(Boolean)

const matchesAny = (values: string[], patterns: readonly RegExp[]): boolean =>
  values.some((value) => patterns.some((re) => re.test(value)))

// A browser wrapper rejects next-pwa's register() (register.js:39, no catch) with a bare "Rejected".
const SW_REGISTER_FRAME = /serviceWorker\.register|ServiceWorkerContainer/
const isRegisterRejection = (event: Sentry.Event): boolean =>
  (event.exception?.values ?? []).some(
    (ex) =>
      ex.value === 'Rejected' &&
      (ex.stacktrace?.frames ?? []).some((f) => SW_REGISTER_FRAME.test(f.function ?? ''))
  )

const isNonActionable = (event: Sentry.Event, values: string[]): boolean => {
  if (matchesAny(values, SW_LIFECYCLE_PATTERNS) || isRegisterRejection(event)) return true
  // Chunk errors are auto-recovered by reload; report only once recovery gave up.
  if (values.some(matchesChunkError)) return !isChunkRecoveryExhausted()
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
      if (isNonActionable(event, values)) return null
      return event
    }
  })
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[observability] NEXT_PUBLIC_GLITCHTIP_DSN is unset — client capture is disabled')
}
