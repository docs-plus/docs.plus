/**
 * Email Provider Types
 *
 * Common interface for all email providers.
 */

export type EmailProvider = 'smtp' | 'resend' | 'sendgrid'

export interface EmailMessage {
  from: string
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  tags?: string[]
  /**
   * Custom email headers (e.g., List-Unsubscribe for RFC 8058)
   */
  headers?: Record<string, string>
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailProviderInterface {
  name: EmailProvider
  send(message: EmailMessage): Promise<SendResult>
  verify(): Promise<boolean>
  isConfigured(): boolean
}
