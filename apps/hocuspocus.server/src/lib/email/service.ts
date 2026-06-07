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
import { emailLogger } from '../logger'
import { getProviderStatus, isAnyProviderConfigured, verifyProvider } from './providers'
import { closeEmailQueue, createEmailWorker, getEmailQueueHealth, queueEmail } from './queue'
import { sendEmailViaProvider } from './sender'

/**
 * Email Gateway Service
 */
export class EmailGatewayService {
  private worker: ReturnType<typeof createEmailWorker> = null
  private initialized = false
  private workerMode = false

  /**
   * Initialize the email gateway
   * @param enableWorker - If true, creates a BullMQ worker to process jobs.
   *                       Set to true ONLY in hocuspocus-worker, NOT in rest-api.
   */
  async initialize(enableWorker = false): Promise<void> {
    if (this.initialized) return

    this.workerMode = enableWorker
    emailLogger.info({ workerMode: enableWorker }, 'Initializing Email Gateway...')

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

    // Only create worker in worker mode (hocuspocus-worker container)
    if (enableWorker) {
      this.worker = createEmailWorker()
      if (!this.worker) {
        emailLogger.error('Failed to create email worker - Redis may not be configured')
      }
    }

    this.initialized = true
    emailLogger.info(
      {
        provider: status.active,
        worker_enabled: this.worker !== null,
        mode: enableWorker ? 'worker' : 'queue-only'
      },
      'Email Gateway initialized'
    )
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      emailLogger.info('Email worker stopped')
    }
    await closeEmailQueue()
    emailLogger.info('Email Gateway shutdown complete')
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
