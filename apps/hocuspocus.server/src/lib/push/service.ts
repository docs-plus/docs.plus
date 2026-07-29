/**
 * rest-api calls `initialize(false)` — queue only, no worker.
 * hocuspocus-worker calls `initialize(true)` — creates the worker that drains it.
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

  /** Queues if Redis is available, otherwise sends synchronously. */
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

    const jobId = await queuePush(jobData)
    if (jobId) {
      return {
        success: true,
        sent: 0, // Will be processed async
        total: 0,
        results: [{ success: true, id: jobId }]
      }
    }

    return sendPushNotification(request)
  }

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

  isOperational(): boolean {
    return this.initialized && isVapidConfigured()
  }
}

export const pushGateway = new PushGatewayService()
