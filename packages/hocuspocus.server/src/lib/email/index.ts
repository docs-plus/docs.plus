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
  DigestChannel,
  DigestDocument,
  DigestEmailRequest,
  DigestNotification,
  EmailFrequency,
  EmailGatewayHealth,
  EmailJobData,
  EmailResult,
  EmailStatus,
  EmailStatusCallback,
  GenericEmailRequest,
  NotificationEmailRequest,
  NotificationType} from '../../types/email.types'
export type { EmailMessage, EmailProvider, SendResult } from './providers'

// Templates
export {
  buildDigestEmailHtml,
  buildDigestEmailText,
  buildNotificationEmailHtml,
  buildNotificationEmailText,
  getEmailSubject} from './templates'

// Core
export { getProviderStatus,isAnyProviderConfigured, sendEmail, verifyProvider } from './providers'
export { createEmailWorker,getEmailQueueHealth, queueEmail } from './queue'
export { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'

// Service (main entry point)
export { emailGateway,EmailGatewayService } from './service'

// Legacy
export { sendNewDocumentNotification } from './document-notification'
