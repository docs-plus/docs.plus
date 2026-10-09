import { randomUUID } from 'node:crypto'

import type { Handler } from 'hono'
import type { Logger } from 'pino'

import { fail, ok } from '../../../http/envelope'
import {
  EMAIL_CHECK_TIMEOUT_MS,
  type EmailMessage,
  type EmailProvider,
  EmailSendError
} from '../../../lib/email/providers/types'
import { maskEmail } from '../../../lib/maskEmail'
import { toEmailSetupView } from '../domain/toEmailSetupView'
import type {
  EmailBounceRow,
  EmailSetupExtras,
  InitDeps,
  TestSendBudget,
  TestSendResult
} from '../types'

export type ControllerDeps = Omit<InitDeps, 'adminAuth' | 'supabase' | 'redis'> & {
  getLatestBounce: () => Promise<EmailBounceRow | null>
  testSendBudget: TestSendBudget
}

// SMTP ignores the signal, so the timer is what bounds the page load.
const checkConnection = async (
  provider: EmailProvider | null
): Promise<EmailSetupExtras['connection']> => {
  if (!provider) return 'skipped'
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      provider.checkConnection({ signal: AbortSignal.timeout(EMAIL_CHECK_TIMEOUT_MS) }),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), EMAIL_CHECK_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

const settled = <T>(result: PromiseSettledResult<T>, logger: Logger, what: string): T | null => {
  if (result.status === 'fulfilled') return result.value
  logger.warn({ err: result.reason }, `email setup: ${what} unavailable`)
  return null
}

export const createGetSetup =
  (deps: ControllerDeps): Handler =>
  async (c) => {
    const [connection, bounce, queueHealth, dlqDepth] = await Promise.allSettled([
      checkConnection(deps.getEmailProvider()),
      deps.getLatestBounce(),
      deps.getEmailQueueHealth(),
      deps.getEmailDlqDepth()
    ])
    const queue = settled(queueHealth, deps.logger, 'queue health')
    // `unavailable`, not null: null would read as "no bounce yet".
    const latestBounce = settled(bounce, deps.logger, 'latest bounce')
    const view = toEmailSetupView(deps.delivery, deps.facts, {
      // The adapter catches every check failure, so a rejection here is a bug.
      connection: settled(connection, deps.logger, 'connection check') ?? 'timeout',
      latestBounce: bounce.status === 'fulfilled' ? latestBounce : 'unavailable',
      queue: {
        connected: queue?.available ?? false,
        pending: queue ? queue.waiting + queue.delayed : 0,
        dlqDepth: settled(dlqDepth, deps.logger, 'email DLQ depth')
      }
    })
    return ok(c, view)
  }

const testMessage = (from: string, to: string): EmailMessage => ({
  from,
  to: [to],
  subject: 'docs.plus test email',
  text: 'This test email came from the admin Email setup page. Email delivery works.',
  html: '<p>This test email came from the admin Email setup page. Email delivery works.</p>',
  tags: { email_type: 'test' }
})

/** Goes only to the signed-in admin's own address, through the one provider call. */
export const createTestSend =
  (deps: ControllerDeps): Handler =>
  async (c) => {
    const user = c.get('user')
    if (!user?.email) {
      return fail(c, 400, 'NO_EMAIL', 'Your admin account has no email address.')
    }

    const { delivery } = deps
    if (delivery.status !== 'ready') {
      return ok(c, {
        sent: false,
        kind: 'operator',
        code: `email_config_${delivery.status}`
      } satisfies TestSendResult)
    }

    const budget = await deps.testSendBudget(user.sub)
    if (budget === 'limited') {
      return fail(c, 429, 'RATE_LIMITED', 'One test email per minute. Try again shortly.')
    }
    if (budget === 'unavailable') {
      return fail(c, 503, 'SERVICE_UNAVAILABLE', 'Redis is not available, so test email is off.')
    }

    const id = randomUUID()
    try {
      const sent = await deps.deliverEmail(testMessage(delivery.from, user.email), {
        jobId: id,
        idempotencyKey: `${delivery.keyNamespace}/test/${id}`
      })
      return ok(c, {
        sent: true,
        messageId: sent.messageId,
        to: maskEmail(user.email)
      } satisfies TestSendResult)
    } catch (err) {
      // deliverEmail already logged the failure with `err`.
      if (!(err instanceof EmailSendError)) throw err
      return ok(c, { sent: false, kind: err.kind, code: err.code } satisfies TestSendResult)
    }
  }
