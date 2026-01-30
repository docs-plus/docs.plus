/**
 * Push Notification API Router
 *
 * Exposes push gateway as HTTP endpoints.
 * Called by Supabase pg_net for sending push notifications.
 */

import { Hono } from 'hono'

import { pushLogger } from '../lib/logger'
import { pushGateway } from '../lib/push'
import type { PushNotificationRequest } from '../types/push.types'
import { verifyServiceRole } from './utils/serviceRole'

const pushRouter = new Hono()

/**
 * POST /api/push/send
 *
 * Send a push notification to a user.
 * Called by Supabase send_push_notification() trigger.
 *
 * Request body:
 * {
 *   user_id: string,
 *   notification_id: string,
 *   type: string,
 *   sender_name?: string,
 *   sender_avatar?: string,
 *   message_preview?: string,
 *   action_url?: string,
 *   channel_id?: string
 * }
 */
pushRouter.post('/send', async (c) => {
  // Verify authorization
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    pushLogger.warn({ ip: c.req.header('x-forwarded-for') }, 'Unauthorized push send attempt')
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await c.req.json<PushNotificationRequest>()

    // Validate required fields
    if (!payload.user_id || !payload.notification_id) {
      return c.json({ error: 'Missing required fields: user_id, notification_id' }, 400)
    }

    const result = await pushGateway.sendNotification(payload)

    return c.json({
      success: result.success,
      sent: result.sent,
      total: result.total,
      results: result.results
    })
  } catch (err) {
    pushLogger.error({ err }, 'Error processing push send request')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/push/health
 *
 * Get push gateway health status.
 */
pushRouter.get('/health', async (c) => {
  try {
    const health = await pushGateway.getHealth()
    return c.json(health)
  } catch (err) {
    pushLogger.error({ err }, 'Error getting push health')
    return c.json({ error: 'Failed to get health status' }, 500)
  }
})

/**
 * GET /api/push/status
 *
 * Check if push gateway is operational.
 */
pushRouter.get('/status', (c) => {
  return c.json({
    operational: pushGateway.isOperational(),
    timestamp: new Date().toISOString()
  })
})

export default pushRouter
