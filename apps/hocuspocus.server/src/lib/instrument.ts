import * as Sentry from '@sentry/bun'

// DSN-gated: a no-op until GLITCHTIP_DSN is set, so the SDK ships dark and is
// switched on by env without another deploy. serverName separates the 3 roles.
const dsn = process.env.GLITCHTIP_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.GIT_HASH || undefined,
    serverName: process.env.SENTRY_ROLE || 'hocuspocus',
    tracesSampleRate: 0
  })
}

// Re-exported so handled-error sites capture explicitly. captureException is a safe
// no-op when init never ran (DSN unset), so call sites need no extra guard.
export const captureException = Sentry.captureException
