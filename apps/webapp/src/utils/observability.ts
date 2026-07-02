import * as Sentry from '@sentry/nextjs'

import { DocumentFetchError } from './fetchDocument'

type CaptureContext = Parameters<typeof Sentry.captureException>[1]

export function captureUnknown(error: unknown, context?: CaptureContext) {
  const normalized = error instanceof Error ? error : new Error(String(error))
  // No client means the DSN is unset (dev / capture disabled) — surface the
  // failure in the console instead of silently dropping it.
  if (!Sentry.getClient()) {
    console.error('[observability]', normalized, context)
    return
  }
  return Sentry.captureException(normalized, context)
}

const capturedMessageKeys = new Set<string>()

/** One event per key per page load — mirrors the server's captureOnce in instrument.ts. */
export function captureMessageOnce(
  key: string,
  message: string,
  opts?: {
    level?: Sentry.SeverityLevel
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }
) {
  if (capturedMessageKeys.has(key)) return
  capturedMessageKeys.add(key)
  if (!Sentry.getClient()) {
    console.warn('[observability]', message, opts?.extra)
    return
  }
  return Sentry.captureMessage(message, {
    level: opts?.level,
    tags: opts?.tags,
    extra: opts?.extra
  })
}

/** Id only — never email/name (PII stays out of error reports). */
export function setObservabilityUser(id: string | null) {
  Sentry.setUser(id ? { id } : null)
}

/** Skip expected client failures (404/private slug); keep network + 5xx for incidents. */
export function shouldCaptureGsspDocumentError(error: unknown): boolean {
  if (!(error instanceof DocumentFetchError)) return true
  if (error.status === undefined) return true
  return error.status >= 500
}

export function captureGsspDocumentError(error: unknown, context?: CaptureContext) {
  if (!shouldCaptureGsspDocumentError(error)) return
  return captureUnknown(error, context)
}

export function captureCollabIssueOnce(
  reported: Set<string>,
  documentId: string,
  slug: string,
  kind: string,
  extra: Record<string, unknown>
) {
  const key = `${documentId}:${kind}`
  if (reported.has(key)) return
  reported.add(key)
  Sentry.captureMessage(`collab:${kind}`, {
    level: 'error',
    tags: { surface: 'hocuspocus-provider' },
    extra: { documentId, slug, ...extra }
  })
}
