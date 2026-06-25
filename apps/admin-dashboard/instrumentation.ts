import * as Sentry from '@sentry/nextjs'

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'production',
      release: process.env.NEXT_PUBLIC_GIT_HASH || undefined,
      tracesSampleRate: 0
    })
  }
}

export const onRequestError = Sentry.captureRequestError
