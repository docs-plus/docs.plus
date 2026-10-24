import * as Sentry from '@sentry/nextjs'

import { sentryDataCollection } from './sentryDataCollection'

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_GIT_HASH || undefined,
    tracesSampleRate: 0,
    dataCollection: sentryDataCollection
  })
}
