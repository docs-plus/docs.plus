/**
 * Email Gateway Module
 *
 * ARCHITECTURE (pgmq Consumer):
 *   Supabase email_queue → pg_cron → pgmq → pgmqConsumer → BullMQ → SMTP
 *
 * The pgmqConsumer polls the Supabase queue every 2 seconds.
 * BullMQ worker sends emails via configured provider.
 *
 * @see docs/NOTIFICATION_ARCHITECTURE_COMPARISON.md
 */

// Types
export type {
  BounceType,
  DigestChannel,
  DigestDocument,
  DigestEmailRequest,
  DigestNotification,
  EmailBounceEvent,
  EmailFrequency,
  EmailGatewayHealth,
  EmailJobData,
  EmailResult,
  EmailStatus,
  EmailStatusCallback,
  GenericEmailRequest,
  NotificationEmailRequest,
  NotificationType
} from '../../types/email.types'
export type { EmailMessage, EmailProvider, SendResult } from './providers'

// Templates
export {
  buildDigestEmailHtml,
  buildDigestEmailText,
  buildNewDocumentEmailHtml,
  buildNewDocumentEmailText,
  buildNotificationEmailHtml,
  buildNotificationEmailText,
  getEmailSubject
} from './templates'

// Core
export { getProviderStatus, isAnyProviderConfigured, sendEmail, verifyProvider } from './providers'
export { createEmailWorker, getEmailQueueHealth, queueEmail } from './queue'
export { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'

// Service (main entry point)
export { emailGateway, EmailGatewayService } from './service'

// pgmq Consumer - polls Supabase queue
export {
  getEmailQueueConsumerHealth,
  startEmailQueueConsumer,
  stopEmailQueueConsumer
} from './pgmqConsumer'

// Legacy
export { sendNewDocumentNotification } from './document-notification'
