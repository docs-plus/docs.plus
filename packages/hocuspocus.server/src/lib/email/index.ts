/**
 * Email Gateway Module
 *
 * Usage:
 *   import { emailGateway } from './lib/email'
 *   await emailGateway.sendNotificationEmail(request)
 *
 * Configuration:
 *   EMAIL_PROVIDER: 'smtp' | 'resend' | 'sendgrid' (optional)
 *   EMAIL_FROM: Sender email address
 *
 *   SMTP: SMTP_HOST, SMTP_USER, SMTP_PASS
 *   Resend: RESEND_API_KEY
 *   SendGrid: SENDGRID_API_KEY
 */

// Types
export type {
  NotificationType,
  EmailFrequency,
  EmailStatus,
  NotificationEmailRequest,
  GenericEmailRequest,
  DigestEmailRequest,
  DigestDocument,
  DigestChannel,
  DigestNotification,
  EmailResult,
  EmailJobData,
  EmailGatewayHealth,
  EmailStatusCallback
} from '../../types/email.types'

export type { EmailProvider, EmailMessage, SendResult } from './providers'

// Templates
export {
  getEmailSubject,
  buildNotificationEmailHtml,
  buildNotificationEmailText,
  buildDigestEmailHtml,
  buildDigestEmailText
} from './templates'

// Core
export { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'
export { sendEmail, verifyProvider, isAnyProviderConfigured, getProviderStatus } from './providers'
export { queueEmail, getEmailQueueHealth, createEmailWorker } from './queue'

// Service (main entry point)
export { EmailGatewayService, emailGateway } from './service'

// Legacy
export { sendNewDocumentNotification } from './document-notification'
