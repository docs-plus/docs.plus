/**
 * Email API Router
 *
 * Exposes email gateway as HTTP endpoints.
 * Called by Supabase pg_net for sending notification emails.
 */

import { Hono } from 'hono'

import { emailGateway } from '../lib/email'
import { emailLogger } from '../lib/logger'
import type {
  DigestEmailRequest,
  GenericEmailRequest,
  NotificationEmailRequest} from '../types/email.types'
import { verifyServiceRole } from './utils/serviceRole'

const emailRouter = new Hono()

/**
 * POST /api/email/send
 *
 * Send a notification email.
 * Called by Supabase process_email_queue function.
 */
emailRouter.post('/send', async (c) => {
  // Verify authorization
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    emailLogger.warn({ ip: c.req.header('x-forwarded-for') }, 'Unauthorized email send attempt')
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await c.req.json<NotificationEmailRequest>()

    // Validate required fields
    if (!payload.to || !payload.queue_id) {
      return c.json({ error: 'Missing required fields: to, queue_id' }, 400)
    }

    const result = await emailGateway.sendNotificationEmail(payload)

    if (result.success) {
      return c.json({
        success: true,
        message_id: result.message_id,
        queue_id: result.queue_id
      })
    }

    return c.json(
      {
        success: false,
        error: result.error,
        queue_id: result.queue_id
      },
      500
    )
  } catch (err) {
    emailLogger.error({ err }, 'Error processing email send request')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/email/send-generic
 *
 * Send a generic email (for internal use).
 */
emailRouter.post('/send-generic', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await c.req.json<GenericEmailRequest>()

    if (!payload.to || !payload.subject || !payload.html) {
      return c.json({ error: 'Missing required fields: to, subject, html' }, 400)
    }

    const result = await emailGateway.sendGenericEmail(payload)

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
emailRouter.post('/send-digest', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!verifyServiceRole(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await c.req.json<DigestEmailRequest>()

    if (!payload.to || !payload.frequency || !payload.documents || payload.documents.length === 0) {
      return c.json({ error: 'Missing required fields: to, frequency, documents' }, 400)
    }

    const result = await emailGateway.sendDigestEmail(payload)

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

    const result = await response.json()

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
          message: result.message,
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
emailRouter.post('/unsubscribe', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.json({ error: 'Missing token' }, 400)
  }

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

    const result = await response.json()

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
})

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
