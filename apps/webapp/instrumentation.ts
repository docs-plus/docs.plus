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
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[observability] NEXT_PUBLIC_GLITCHTIP_DSN is unset — server capture is disabled')
  }
}

export const onRequestError = Sentry.captureRequestError
