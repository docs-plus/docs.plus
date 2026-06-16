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

import { config } from '../../config/env'
import type {
  PushGatewayHealth,
  PushJobData,
  PushNotificationRequest,
  PushSendResult
} from '../../types/push.types'
import { NotificationGatewayBase } from '../gateway'
import { pushLogger } from '../logger'
import { closePushQueue, createPushWorker, getPushQueueHealth, queuePush } from './queue'
import { configureVapid, isVapidConfigured, sendPushNotification } from './sender'

/**
 * Push Gateway Service
 */
export class PushGatewayService extends NotificationGatewayBase {
  constructor() {
    super({
      label: 'Push',
      logger: pushLogger,
      configure: () => {
        // VAPID is needed for both queueing and sending
        if (!configureVapid()) {
          pushLogger.warn('Push Gateway running without VAPID - notifications will fail')
        }
      },
      createWorker: createPushWorker,
      closeQueue: closePushQueue
    })
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
      vapid_configured: isVapidConfigured(),
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
