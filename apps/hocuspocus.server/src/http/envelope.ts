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

// Required: without it @hono/zod-validator emits its own body shape.
export const houseEnvelopeHook = (
  result: { success: boolean },
  c: Context
): Response | undefined =>
  result.success ? undefined : fail(c, 400, 'VALIDATION_ERROR', 'Request validation failed')
