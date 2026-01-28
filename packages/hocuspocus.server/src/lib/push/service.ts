/**
 * Push Notification Gateway Service
 *
 * High-level service for push notification operations.
 * Mirrors the email gateway service pattern for consistency.
 *
 * ARCHITECTURE:
 * - rest-api: Calls initialize(false) - queue only, no worker
 * - hocuspocus-worker: Calls initialize(true) - creates worker to process jobs
 */

import { pushLogger } from '../logger'
import { queuePush, getPushQueueHealth, createPushWorker, closePushQueue } from './queue'
import { configureVapid, isVapidConfigured, sendPushNotification } from './sender'
import { config } from '../../config/env'
import type { PushNotificationRequest, PushSendResult, PushGatewayHealth, PushJobData } from '../../types/push.types'

/**
 * Push Gateway Service
 */
export class PushGatewayService {
  private worker: ReturnType<typeof createPushWorker> = null
  private initialized = false
  private workerMode = false

  /**
   * Initialize the push gateway
   * @param enableWorker - If true, creates a BullMQ worker to process jobs.
   *                       Set to true ONLY in hocuspocus-worker, NOT in rest-api.
   */
  async initialize(enableWorker = false): Promise<void> {
    if (this.initialized) return

    this.workerMode = enableWorker
    pushLogger.info({ workerMode: enableWorker }, 'Initializing Push Gateway...')

    // Configure VAPID (needed for both queueing and sending)
    const vapidOk = configureVapid()
    if (!vapidOk) {
      pushLogger.warn('Push Gateway running without VAPID - notifications will fail')
    }

    // Only create worker in worker mode (hocuspocus-worker container)
    if (enableWorker) {
      this.worker = createPushWorker()
      if (!this.worker) {
        pushLogger.error('Failed to create push worker - Redis may not be configured')
      }
    }

    this.initialized = true

    pushLogger.info({
      vapid_configured: vapidOk,
      worker_enabled: this.worker !== null,
      mode: enableWorker ? 'worker' : 'queue-only'
    }, 'Push Gateway initialized')
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      pushLogger.info('Push worker stopped')
    }
    await closePushQueue()
    pushLogger.info('Push Gateway shutdown complete')
  }

  /**
   * Send a push notification
   * Queues if Redis available, otherwise sends synchronously
   */
  async sendNotification(request: PushNotificationRequest): Promise<PushSendResult> {
    if (!isVapidConfigured()) {
      return {
        success: false,
        sent: 0,
        total: 0,
        error: 'Push notifications not configured (VAPID keys missing)'
      }
    }

    const jobData: PushJobData = {
      type: 'notification',
      payload: request,
      created_at: new Date().toISOString()
    }

    // Try to queue first (async, faster response)
    const jobId = await queuePush(jobData)
    if (jobId) {
      return {
        success: true,
        sent: 0, // Will be processed async
        total: 0,
        results: [{ success: true, id: jobId }]
      }
    }

    // Fallback: send synchronously
    return sendPushNotification(request)
  }

  /**
   * Get push gateway health status
   */
  async getHealth(): Promise<PushGatewayHealth> {
    const queueHealth = await getPushQueueHealth()

    return {
      configured: isVapidConfigured(),
      vapid_subject: config.push.vapid.subject || null,
      queue_connected: queueHealth.available,
      pending_jobs: queueHealth.waiting + queueHealth.delayed,
      failed_jobs: queueHealth.failed,
      sent_last_hour: queueHealth.completed
    }
  }

  /**
   * Check if gateway is operational
   */
  isOperational(): boolean {
    return this.initialized && isVapidConfigured()
  }
}

export const pushGateway = new PushGatewayService()

