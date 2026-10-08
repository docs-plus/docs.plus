/**
 * rest-api calls `initialize(false)` — queue only, no worker.
 * hocuspocus-worker calls `initialize(true)` — creates the worker that drains it.
 */

import { config } from '../../config/env'
import type {
  DigestEmailRequest,
  EmailGatewayHealth,
  EmailJobData,
  EmailResult,
  GenericEmailRequest,
  NotificationEmailRequest
} from '../../types/email.types'
import { NotificationGatewayBase } from '../gateway'
import { emailLogger } from '../logger'
import { closeEmailProvider, EmailSendError, getEmailProvider } from './providers'
import { closeEmailQueue, createEmailWorker, getEmailQueueHealth, queueEmail } from './queue'
import { sendEmailViaProvider } from './sender'

/** An `invalid` config holds mail, so the worker repeats the line that pages. */
const CONFIG_INVALID_REPEAT_MS = 5 * 60 * 1000

function logEmailConfig(): void {
  const delivery = config.email.delivery
  if (delivery.status === 'ready') {
    emailLogger.info({ provider: delivery.provider.name }, 'email config ready')
  } else if (delivery.status === 'off') {
    emailLogger.info('email config off')
  } else {
    emailLogger.error({ problems: delivery.problems }, 'email config invalid')
  }
}

// Logged as `{ err }` so a bad credential still pages at boot through
// incident-email-broken (err_code EAUTH), and a transient 454 still does not.
async function checkProviderConnection(): Promise<void> {
  const provider = getEmailProvider()
  if (!provider) return
  const check = await provider.checkConnection({ signal: AbortSignal.timeout(10_000) })
  if (check.ok) {
    emailLogger.info({ provider: provider.name, note: check.note }, 'Email connection check passed')
    return
  }
  const err = new EmailSendError(check.kind, check.code, check.message, {
    responseCode: check.responseCode
  })
  emailLogger.error({ err, provider: provider.name }, 'Email connection check failed')
}

export class EmailGatewayService extends NotificationGatewayBase {
  private invalidRepeat: ReturnType<typeof setInterval> | null = null

  constructor() {
    super({
      label: 'Email',
      logger: emailLogger,
      configure: logEmailConfig,
      // `invalid` holds mail: no worker drains the queue until the config is fixed.
      createWorker: () => (config.email.delivery.status === 'invalid' ? null : createEmailWorker()),
      closeQueue: closeEmailQueue
    })
  }

  override async initialize(enableWorker = false): Promise<void> {
    if (this.initialized) return
    await super.initialize(enableWorker)
    if (!enableWorker) return

    // Not awaited: the result only logs, so boot must not wait on a provider.
    void checkProviderConnection().catch((err: unknown) => {
      emailLogger.error({ err }, 'Email connection check failed')
    })
    if (config.email.delivery.status === 'invalid') {
      this.invalidRepeat = setInterval(logEmailConfig, CONFIG_INVALID_REPEAT_MS)
      this.invalidRepeat.unref()
    }
  }

  override async shutdown(): Promise<void> {
    if (this.invalidRepeat) clearInterval(this.invalidRepeat)
    this.invalidRepeat = null
    await super.shutdown()
    await closeEmailProvider()
  }

  async sendNotificationEmail(request: NotificationEmailRequest): Promise<EmailResult> {
    const jobData: EmailJobData = {
      type: 'notification',
      payload: request,
      created_at: new Date().toISOString()
    }

    const jobId = await queueEmail(jobData)
    if (jobId) {
      return { success: true, message_id: jobId, queue_id: request.queue_id }
    }
    return sendEmailViaProvider(jobData)
  }

  async sendDigestEmail(request: DigestEmailRequest): Promise<EmailResult> {
    const jobData: EmailJobData = {
      type: 'digest',
      payload: request,
      created_at: new Date().toISOString()
    }

    const jobId = await queueEmail(jobData)
    if (jobId) {
      return { success: true, message_id: jobId }
    }
    return sendEmailViaProvider(jobData)
  }

  async sendGenericEmail(request: GenericEmailRequest): Promise<EmailResult> {
    const jobData: EmailJobData = {
      type: 'generic',
      payload: request,
      created_at: new Date().toISOString()
    }

    const jobId = await queueEmail(jobData)
    if (jobId) {
      return { success: true, message_id: jobId }
    }
    return sendEmailViaProvider(jobData)
  }

  async getHealth(): Promise<EmailGatewayHealth & { provider: string | null }> {
    const queueHealth = await getEmailQueueHealth()
    const delivery = config.email.delivery

    // Keys stay as they were: the admin Notifications page reads them.
    return {
      provider: delivery.status === 'ready' ? delivery.provider.name : null,
      smtp_configured: delivery.status === 'ready',
      queue_connected: queueHealth.available,
      pending_jobs: queueHealth.waiting + queueHealth.delayed,
      failed_jobs: queueHealth.failed,
      sent_last_hour: queueHealth.completed
    }
  }

  isOperational(): boolean {
    return this.initialized && config.email.delivery.status === 'ready'
  }
}

export const emailGateway = new EmailGatewayService()
