/**
 * Email API Router
 *
 * ARCHITECTURE (pgmq Consumer):
 *   Supabase email_queue → pg_cron → pgmq → pgmqConsumer → BullMQ → SMTP
 *
 * The /api/email/send endpoint has been removed.
 * Emails are now queued via pgmq and consumed by the worker.
 *
 * Remaining endpoints:
 * - /api/email/send-generic: Internal generic email sending
 * - /api/email/send-digest: Digest emails
 * - /api/email/health: Health check
 * - /api/email/unsubscribe: One-click unsubscribe
 *
 * @see docs/NOTIFICATION_ARCHITECTURE_COMPARISON.md
 */

import { zValidator } from '@hono/zod-validator'
import { createClient } from '@supabase/supabase-js'
import { Hono } from 'hono'
import { z } from 'zod'

import { emailGateway } from '../lib/email'
import { buildDigestEmailHtml, buildNotificationEmailHtml } from '../lib/email/templates'
import { emailLogger } from '../lib/logger'
import {
  emailBounceSchema,
  sendDigestEmailSchema,
  sendGenericEmailSchema
} from '../schemas/email.schema'
import { verifyServiceRole } from './utils/serviceRole'

const emailRouter = new Hono()

/**
 * POST /api/email/send-generic
 *
 * Send a generic email (for internal use).
 */
emailRouter.post('/send-generic', zValidator('json', sendGenericEmailSchema), async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = c.req.valid('json')

    // Transform to GenericEmailRequest (to must be array)
    const result = await emailGateway.sendGenericEmail({
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo
    })

    if (result.success) {
      return c.json({ success: true, message_id: result.message_id })
    }

    return c.json({ success: false, error: result.error }, 500)
  } catch (err) {
    emailLogger.error({ err }, 'Error processing generic email request')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/email/send-digest
 *
 * Send a digest email (daily or weekly summary).
 * Called by Supabase cron job.
 */
emailRouter.post('/send-digest', zValidator('json', sendDigestEmailSchema), async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = c.req.valid('json')

    // Transform to DigestEmailRequest
    const result = await emailGateway.sendDigestEmail({
      to: payload.to,
      recipient_name: payload.user_name || 'User',
      recipient_id: 'api-request', // Not a real user, just API call
      frequency: payload.frequency,
      documents: payload.documents.map((doc) => ({
        name: doc.title || doc.slug,
        slug: doc.slug,
        url: `${process.env.APP_URL || 'https://docs.plus'}/${doc.slug}`,
        channels: [] // Simplified - no channel breakdown for API-triggered digests
      })),
      period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString()
    })

    if (result.success) {
      return c.json({ success: true, message_id: result.message_id })
    }

    return c.json({ success: false, error: result.error }, 500)
  } catch (err) {
    emailLogger.error({ err }, 'Error processing digest email request')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/email/health
 *
 * Get email gateway health status.
 */
emailRouter.get('/health', async (c) => {
  try {
    const health = await emailGateway.getHealth()
    return c.json(health)
  } catch (err) {
    emailLogger.error({ err }, 'Error getting email health')
    return c.json({ error: 'Failed to get health status' }, 500)
  }
})

/**
 * GET /api/email/status
 *
 * Check if email gateway is operational.
 */
emailRouter.get('/status', (c) => {
  return c.json({
    operational: emailGateway.isOperational(),
    timestamp: new Date().toISOString()
  })
})

// =============================================================================
// BOUNCE WEBHOOK
// =============================================================================

/**
 * POST /api/email/bounce
 *
 * Record an email bounce event from a provider.
 * Hard bounces auto-disable email for the affected user.
 */
emailRouter.post('/bounce', zValidator('json', emailBounceSchema), async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const { email, bounce_type, provider, reason } = c.req.valid('json')

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data, error } = await supabase.rpc('record_email_bounce', {
      p_email: email,
      p_bounce_type: bounce_type,
      p_provider: provider || null,
      p_reason: reason || null
    })

    if (error) {
      emailLogger.error({ err: error, email, bounce_type }, 'Failed to record bounce')
      return c.json({ error: 'Failed to record bounce' }, 500)
    }

    emailLogger.info({ email, bounce_type, provider }, 'Email bounce recorded')

    return c.json({
      success: true,
      bounce_id: data,
      auto_suppressed: bounce_type === 'hard'
    })
  } catch (err) {
    emailLogger.error({ err }, 'Error processing bounce webhook')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// =============================================================================
// TEMPLATE PREVIEW (development/testing)
// =============================================================================

/**
 * GET /api/email/preview/:type
 *
 * Render an email template with sample data for visual testing.
 * Types: notification, digest
 */
emailRouter.get('/preview/:type', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const type = c.req.param('type')
  const appUrl = process.env.APP_URL || 'https://docs.plus'

  if (type === 'notification') {
    const html = buildNotificationEmailHtml({
      recipientName: 'Jane Smith',
      senderName: 'John Doe',
      notificationType: 'mention',
      messagePreview:
        "Hey @Jane, can you review the latest changes to the API docs? I've updated the authentication section.",
      actionUrl: `${appUrl}/api-documentation?chatroom=general`,
      documentName: 'API Documentation',
      channelName: 'general'
    })
    return c.html(html)
  }

  if (type === 'digest') {
    const html = buildDigestEmailHtml({
      recipientName: 'Jane Smith',
      frequency: 'daily',
      documents: [
        {
          name: 'API Documentation',
          slug: 'api-documentation',
          url: `${appUrl}/api-documentation`,
          channels: [
            {
              name: 'general',
              id: 'ch-001',
              url: `${appUrl}/api-documentation?chatroom=ch-001`,
              notifications: [
                {
                  type: 'mention',
                  sender_name: 'John Doe',
                  message_preview: 'Hey @Jane, can you review the auth section?',
                  action_url: `${appUrl}/api-documentation?chatroom=ch-001`,
                  created_at: new Date(Date.now() - 3600000).toISOString()
                },
                {
                  type: 'reply',
                  sender_name: 'Alice Chen',
                  message_preview: "I've added the rate limiting docs as discussed.",
                  action_url: `${appUrl}/api-documentation?chatroom=ch-001`,
                  created_at: new Date(Date.now() - 7200000).toISOString()
                }
              ]
            }
          ]
        },
        {
          name: 'Product Roadmap',
          slug: 'product-roadmap',
          url: `${appUrl}/product-roadmap`,
          channels: [
            {
              name: 'q1-planning',
              id: 'ch-002',
              url: `${appUrl}/product-roadmap?chatroom=ch-002`,
              notifications: [
                {
                  type: 'reaction',
                  sender_name: 'Bob Wilson',
                  message_preview: 'Reacted to your message about the timeline',
                  action_url: `${appUrl}/product-roadmap?chatroom=ch-002`,
                  created_at: new Date(Date.now() - 14400000).toISOString()
                }
              ]
            }
          ]
        }
      ],
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString()
    })
    return c.html(html)
  }

  return c.json({ error: `Unknown template type: ${type}. Use "notification" or "digest".` }, 400)
})

// =============================================================================
// UNSUBSCRIBE ENDPOINTS
// =============================================================================

/**
 * GET /api/email/unsubscribe
 *
 * Process one-click unsubscribe from email link.
 * Verifies token and updates user preferences without authentication.
 * Returns HTML page with confirmation/error.
 */
emailRouter.get('/unsubscribe', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.html(
      buildUnsubscribeHtml({
        success: false,
        title: 'Invalid Link',
        message: 'This unsubscribe link is missing required information.',
        showManageLink: true
      })
    )
  }

  try {
    // Call Supabase to process the unsubscribe
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      emailLogger.error('Supabase credentials not configured for unsubscribe')
      return c.html(
        buildUnsubscribeHtml({
          success: false,
          title: 'Service Error',
          message: 'Unable to process your request. Please try again later.',
          showManageLink: true
        })
      )
    }

    // Call the process_unsubscribe function via Supabase RPC
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ p_token: token })
    })

    if (!response.ok) {
      emailLogger.error({ status: response.status }, 'Supabase RPC failed')
      return c.html(
        buildUnsubscribeHtml({
          success: false,
          title: 'Error',
          message: 'Unable to process your request. The link may be invalid or expired.',
          showManageLink: true
        })
      )
    }

    const result = (await response.json()) as {
      success: boolean
      user_id?: string
      action?: string
      action_description?: string
      message?: string
      email?: string
    }

    if (result.success) {
      emailLogger.info(
        {
          user_id: result.user_id,
          action: result.action
        },
        'User unsubscribed via email link'
      )

      return c.html(
        buildUnsubscribeHtml({
          success: true,
          title: 'Unsubscribed',
          message: result.message || 'You have been unsubscribed successfully.',
          _actionDescription: result.action_description,
          email: result.email,
          action: result.action,
          showManageLink: true,
          showUndoLink: true,
          token: token
        })
      )
    }

    return c.html(
      buildUnsubscribeHtml({
        success: false,
        title: 'Unable to Unsubscribe',
        message: result.message || 'The unsubscribe link is invalid or has expired.',
        showManageLink: true
      })
    )
  } catch (err) {
    emailLogger.error({ err }, 'Error processing unsubscribe')
    return c.html(
      buildUnsubscribeHtml({
        success: false,
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.',
        showManageLink: true
      })
    )
  }
})

/**
 * POST /api/email/unsubscribe
 *
 * RFC 8058 List-Unsubscribe-Post handler for one-click unsubscribe.
 * Email clients send POST with "List-Unsubscribe=One-Click" in body.
 */
emailRouter.post(
  '/unsubscribe',
  zValidator('query', z.object({ token: z.string().min(1) })),
  async (c) => {
    const { token } = c.req.valid('query')

    try {
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        return c.json({ error: 'Service not configured' }, 500)
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ p_token: token })
      })

      if (!response.ok) {
        return c.json({ error: 'Failed to process unsubscribe' }, 500)
      }

      const result = (await response.json()) as {
        success: boolean
        user_id?: string
        action?: string
        error?: string
      }

      if (result.success) {
        emailLogger.info(
          {
            user_id: result.user_id,
            action: result.action
          },
          'User unsubscribed via List-Unsubscribe-Post'
        )
        return c.json({ success: true })
      }

      return c.json({ error: result.error || 'Invalid token' }, 400)
    } catch (err) {
      emailLogger.error({ err }, 'Error processing List-Unsubscribe-Post')
      return c.json({ error: 'Internal error' }, 500)
    }
  }
)

// =============================================================================
// UNSUBSCRIBE HTML BUILDER
// =============================================================================

interface UnsubscribePageParams {
  success: boolean
  title: string
  message: string
  _actionDescription?: string
  email?: string
  action?: string
  showManageLink?: boolean
  showUndoLink?: boolean
  token?: string
}

function buildUnsubscribeHtml(params: UnsubscribePageParams): string {
  const {
    success,
    title,
    message,
    _actionDescription,
    email,
    showManageLink,
    showUndoLink,
    token
  } = params

  const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://docs.plus'
  const APP_NAME = 'docs.plus'

  const icon = success
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'

  const actions: string[] = []

  if (showManageLink) {
    actions.push(
      `<a href="${APP_URL}/settings/notifications" style="display: inline-block; background: #1a73e8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; margin: 8px;">Manage Preferences</a>`
    )
  }

  if (showUndoLink && token) {
    actions.push(
      `<a href="${APP_URL}" style="display: inline-block; background: white; color: #1a73e8; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; border: 1px solid #1a73e8; margin: 8px;">Go to ${APP_NAME}</a>`
    )
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${APP_NAME}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon { margin-bottom: 24px; }
    h1 {
      color: #1f2937;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .message {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .email {
      color: #9ca3af;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .actions { margin-top: 24px; }
    .logo {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .logo-text {
      color: #9ca3af;
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p class="message">${message}</p>
    ${email ? `<p class="email">${email}</p>` : ''}
    ${actions.length > 0 ? `<div class="actions">${actions.join('')}</div>` : ''}
    <div class="logo">
      <span class="logo-text">${APP_NAME}</span>
    </div>
  </div>
</body>
</html>`
}

export default emailRouter
