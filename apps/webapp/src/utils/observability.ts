import * as Sentry from '@sentry/nextjs'

import { DocumentFetchError } from './fetchDocument'

type CaptureContext = Parameters<typeof Sentry.captureException>[1]

export function captureUnknown(error: unknown, context?: CaptureContext) {
  return Sentry.captureException(error instanceof Error ? error : new Error(String(error)), context)
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
