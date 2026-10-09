import type { Context, Handler, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'

import { fail, ok } from '../../../http/envelope'
import { EmailSendError } from '../../../lib/email/providers/types'
import { maskEmail } from '../../../lib/maskEmail'
import type { EmailBounceEvent } from '../../../types/email.types'
import { toDeliveryEvent } from '../domain/resend/toDeliveryEvent'
import { verifySignature } from '../domain/resend/verifySignature'
import type { DeliveryEvent } from '../domain/types'
import type { WebhookDedupe } from '../infra/webhookDedupe'

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024

export interface ControllerDeps {
  webhookSecret: string
  /** This server's `ns` tag as Resend returns it; null skips the environment check. */
  namespaceTag: string | null
  dedupe: WebhookDedupe
  recordEmailBounce: (event: EmailBounceEvent) => Promise<unknown>
  logger: Logger
}

export const webhookBodyLimit: MiddlewareHandler = bodyLimit({
  maxSize: MAX_WEBHOOK_BODY_BYTES,
  onError: (c) => fail(c, 413, 'PAYLOAD_TOO_LARGE', 'Webhook body is too large')
})

// One body for every rejection, so a caller cannot tell which check failed.
const unauthorized = (c: Context): Response =>
  fail(c, 401, 'UNAUTHORIZED', 'Invalid webhook signature')

type RecordableEvent = Exclude<DeliveryEvent, { type: 'ignored' }>

const applyEvent = async (event: RecordableEvent, deps: ControllerDeps): Promise<void> => {
  if (event.type === 'failed') {
    // Resend accepted the send and failed it later, for example on a used-up
    // quota. `err_kind` operator lets incident-email-operator count it.
    const err = new EmailSendError('operator', event.reason ?? 'unknown', 'Resend failed the email')
    deps.logger.error(
      { err, jobId: event.jobId, provider: 'resend', to: event.emails.map(maskEmail).join(',') },
      'Email failed after send'
    )
    return
  }

  const bounceType = event.type === 'complaint' ? 'complaint' : 'hard'
  for (const email of event.emails) {
    await deps.recordEmailBounce({
      email,
      bounce_type: bounceType,
      provider: 'resend',
      reason: event.reason
    })
  }
}

/**
 * Order is fixed: raw body, signature, then the dedupe claim. A key is never
 * claimed for an unsigned request, so a forger cannot block a real event.
 */
export const createController =
  (deps: ControllerDeps): Handler =>
  async (c) => {
    const body = new Uint8Array(await c.req.arrayBuffer())
    const messageId = c.req.header('svix-id')
    const check = await verifySignature(
      deps.webhookSecret,
      {
        id: messageId,
        timestamp: c.req.header('svix-timestamp'),
        signature: c.req.header('svix-signature')
      },
      body,
      Math.floor(Date.now() / 1000)
    )
    if (check !== 'valid' || !messageId) {
      deps.logger.warn({ reason: check }, 'email webhook signature rejected')
      return unauthorized(c)
    }

    let payload: unknown
    try {
      payload = JSON.parse(new TextDecoder().decode(body))
    } catch {
      deps.logger.warn({ svixId: messageId }, 'email webhook body is not JSON')
      return fail(c, 400, 'BAD_REQUEST', 'Webhook body is not JSON')
    }

    const event = toDeliveryEvent(payload, deps.namespaceTag)
    if (event.type === 'ignored') return ok(c, { received: true })

    let claim
    try {
      claim = await deps.dedupe.claim(messageId)
    } catch (err) {
      deps.logger.error({ err, svixId: messageId }, 'email webhook dedupe unavailable')
      return fail(c, 503, 'SERVICE_UNAVAILABLE', 'Event not recorded. Retry later.')
    }
    // `done` is a redelivery of a recorded event: a 409 would make Svix retry it.
    if (claim === 'done') return ok(c, { received: true })
    if (claim === 'pending') {
      return fail(c, 409, 'CONFLICT', 'This event is still being recorded. Retry later.')
    }

    try {
      await applyEvent(event, deps)
    } catch (err) {
      deps.logger.error(
        { err, svixId: messageId, type: event.type },
        'email webhook event not recorded'
      )
      await deps.dedupe.release(messageId).catch((releaseErr: unknown) => {
        deps.logger.warn({ err: releaseErr, svixId: messageId }, 'email webhook key not released')
      })
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Event not recorded. Retry later.')
    }

    // The write stands. A lost done mark only lets a redelivery after 60 s write again.
    await deps.dedupe.markDone(messageId).catch((err: unknown) => {
      deps.logger.warn({ err, svixId: messageId }, 'email webhook key not marked done')
    })
    return ok(c, { received: true })
  }
