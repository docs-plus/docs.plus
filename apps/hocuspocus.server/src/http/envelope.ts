import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** House envelope, hand-rolled so 4xx stays out of the Sentry-capturing error path. */
export const ok = (c: Context, data: unknown): Response => c.json({ success: true, data })

export const fail = (
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string
): Response => c.json({ success: false, error: { message, code } }, status)

interface ValidationIssue {
  path: PropertyKey[]
  message: string
}

// Required: without it @hono/zod-validator emits its own body shape. `fields`
// names each rejected input, so a caller can fix it without guessing.
export const houseEnvelopeHook = (
  result: { success: boolean; error?: { issues?: readonly ValidationIssue[] } },
  c: Context
): Response | undefined => {
  if (result.success) return undefined
  const fields = (result.error?.issues ?? []).map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message
  }))
  return c.json(
    {
      success: false,
      error: { message: 'Request validation failed', code: 'VALIDATION_ERROR', fields }
    },
    400
  )
}
