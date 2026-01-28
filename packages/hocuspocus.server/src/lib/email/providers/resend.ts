/**
 * Resend Provider
 *
 * Modern email API with excellent deliverability.
 * https://resend.com
 *
 * Required env: RESEND_API_KEY
 */

import { emailLogger } from '../../logger'
import type { EmailProviderInterface, EmailMessage, SendResult } from './types'

const RESEND_API_URL = 'https://api.resend.com/emails'

export const resendProvider: EmailProviderInterface = {
  name: 'resend',

  async send(message: EmailMessage): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
          tags: message.tags?.map((tag) => ({ name: tag, value: 'true' })),
          headers: message.headers
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = errorData.message || `HTTP ${response.status}`
        emailLogger.error({ status: response.status, error, to: message.to }, 'Resend API error')
        return { success: false, error }
      }

      const data = await response.json()
      emailLogger.info({ messageId: data.id, to: message.to }, 'Email sent via Resend')
      return { success: true, messageId: data.id }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      emailLogger.error({ err, to: message.to }, 'Resend send failed')
      return { success: false, error }
    }
  },

  async verify(): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return false

    try {
      // Verify by fetching domains (lightweight API call)
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })

      if (response.ok) {
        emailLogger.info('Resend API verified')
        return true
      }
      return false
    } catch (err) {
      emailLogger.error({ err }, 'Resend verification failed')
      return false
    }
  },

  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY
  }
}
