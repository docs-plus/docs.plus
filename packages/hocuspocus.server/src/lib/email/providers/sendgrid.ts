/**
 * SendGrid Provider
 *
 * Enterprise-grade email delivery platform.
 * https://sendgrid.com
 *
 * Required env: SENDGRID_API_KEY
 */

import { emailLogger } from '../../logger'
import type { EmailMessage, EmailProviderInterface, SendResult } from './types'

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'

export const sendgridProvider: EmailProviderInterface = {
  name: 'sendgrid',

  async send(message: EmailMessage): Promise<SendResult> {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      return { success: false, error: 'SENDGRID_API_KEY not configured' }
    }

    try {
      const response = await fetch(SENDGRID_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: message.to }]
            }
          ],
          from: { email: message.from },
          reply_to: message.replyTo ? { email: message.replyTo } : undefined,
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            { type: 'text/html', value: message.html }
          ],
          categories: message.tags,
          headers: message.headers
        })
      })

      // SendGrid returns 202 Accepted for successful sends
      if (response.status === 202) {
        const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`
        emailLogger.info({ messageId, to: message.to }, 'Email sent via SendGrid')
        return { success: true, messageId }
      }

      const errorData = (await response.json().catch(() => ({}))) as {
        errors?: { message?: string }[]
      }
      const error = errorData.errors?.[0]?.message || `HTTP ${response.status}`
      emailLogger.error({ status: response.status, error, to: message.to }, 'SendGrid API error')
      return { success: false, error }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      emailLogger.error({ err, to: message.to }, 'SendGrid send failed')
      return { success: false, error }
    }
  },

  async verify(): Promise<boolean> {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return false

    try {
      // Verify by checking API key scopes
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })

      if (response.ok) {
        emailLogger.info('SendGrid API verified')
        return true
      }
      return false
    } catch (err) {
      emailLogger.error({ err }, 'SendGrid verification failed')
      return false
    }
  },

  isConfigured(): boolean {
    return !!process.env.SENDGRID_API_KEY
  }
}
