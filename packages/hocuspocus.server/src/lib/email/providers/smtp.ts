/**
 * SMTP Provider
 *
 * Built-in email provider using Nodemailer.
 * Supports any SMTP server (Gmail, Outlook, custom, etc.)
 */

import nodemailer from 'nodemailer'
import { emailLogger } from '../../logger'
import type { EmailProviderInterface, EmailMessage, SendResult } from './types'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10
  })

  emailLogger.info({ host }, 'SMTP provider initialized')
  return transporter
}

export const smtpProvider: EmailProviderInterface = {
  name: 'smtp',

  async send(message: EmailMessage): Promise<SendResult> {
    const smtp = getTransporter()
    if (!smtp) {
      return { success: false, error: 'SMTP not configured' }
    }

    try {
      const info = await smtp.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        headers: message.headers
      })

      emailLogger.info({ messageId: info.messageId, to: message.to }, 'Email sent via SMTP')
      return { success: true, messageId: info.messageId }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      emailLogger.error({ err, to: message.to }, 'SMTP send failed')
      return { success: false, error }
    }
  },

  async verify(): Promise<boolean> {
    const smtp = getTransporter()
    if (!smtp) return false

    try {
      await smtp.verify()
      emailLogger.info('SMTP connection verified')
      return true
    } catch (err) {
      emailLogger.error({ err }, 'SMTP verification failed')
      return false
    }
  },

  isConfigured(): boolean {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    )
  }
}
