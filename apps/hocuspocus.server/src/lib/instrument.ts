import * as Sentry from '@sentry/bun'

import { AppError } from './errors'

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
} else if (process.env.NODE_ENV === 'production') {
  // Pre-pino boot warning — instrument loads before logger.ts on every entrypoint.
  console.warn('[observability] GLITCHTIP_DSN is unset — GlitchTip capture is disabled')
}

if (dsn && !process.env.GIT_HASH) {
  console.warn('[observability] GIT_HASH is unset — GlitchTip release tag will be missing')
}

type CaptureContext = Parameters<typeof Sentry.captureException>[1]

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export const captureException = Sentry.captureException

export function captureUnknown(value: unknown, context?: CaptureContext) {
  return captureException(toError(value), context)
}

export function shouldCaptureHttpError(error: unknown): boolean {
  if (error instanceof AppError) return error.statusCode >= 500
  return true
}

export function captureHttpError(error: unknown, context?: CaptureContext) {
  if (!shouldCaptureHttpError(error)) return
  return captureUnknown(error, context)
}

const captureOnceKeys = new Set<string>()

/** One GlitchTip event per process for sustained infra failures (pgmq poll loops). */
export function captureOnce(key: string, value: unknown, context?: CaptureContext) {
  if (captureOnceKeys.has(key)) return
  captureOnceKeys.add(key)
  return captureUnknown(value, context)
}

export function captureDegraded(
  kind: string,
  value: unknown,
  context?: { extra?: Record<string, unknown> }
) {
  return Sentry.captureException(toError(value), {
    level: 'warning',
    tags: { degraded: kind },
    extra: context?.extra
  })
}

export const flushObservability = (timeoutMs = 2000) => Sentry.flush(timeoutMs)
