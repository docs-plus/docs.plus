/**
 * Email Gateway Service
 *
 * High-level service for email operations.
 * Supports multiple providers: SMTP, Resend, SendGrid.
 *
 * ARCHITECTURE:
 * - rest-api: Calls initialize(false) - queue only, no worker
 * - hocuspocus-worker: Calls initialize(true) - creates worker to process jobs
 */

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
import { getProviderStatus, isAnyProviderConfigured, verifyProvider } from './providers'
import { closeEmailQueue, createEmailWorker, getEmailQueueHealth, queueEmail } from './queue'
import { sendEmailViaProvider } from './sender'

/**
 * Email Gateway Service
 */
export class EmailGatewayService extends NotificationGatewayBase {
  constructor() {
    super({
      label: 'Email',
      logger: emailLogger,
      configure: async () => {
        const status = getProviderStatus()
        if (status.active) {
          emailLogger.info(
            { provider: status.active, configured: status.configured },
            'Email provider detected'
          )
          const verified = await verifyProvider()
          if (!verified) {
            emailLogger.warn({ provider: status.active }, 'Email provider verification failed')
          }
        } else {
          emailLogger.warn('No email provider configured - gateway in dry-run mode')
        }
      },
      createWorker: createEmailWorker,
      closeQueue: closeEmailQueue
    })
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
    const status = getProviderStatus()

    return {
      provider: status.active,
      smtp_configured: isAnyProviderConfigured(),
      queue_connected: queueHealth.available,
      pending_jobs: queueHealth.waiting + queueHealth.delayed,
      failed_jobs: queueHealth.failed,
      sent_last_hour: queueHealth.completed
    }
  }

  getProvider() {
    return getProviderStatus()
  }

  isOperational(): boolean {
    return this.initialized && isAnyProviderConfigured()
  }
}

export const emailGateway = new EmailGatewayService()
