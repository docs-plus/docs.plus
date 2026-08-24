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
export { sendNewDocumentNotification } from './document-notification'
export {
  getEmailQueueConsumerHealth,
  startEmailQueueConsumer,
  stopEmailQueueConsumer
} from './pgmqConsumer'
export type { EmailMessage, EmailProvider, SendResult } from './providers'
export { getProviderStatus, isAnyProviderConfigured, sendEmail, verifyProvider } from './providers'
export { createEmailWorker, getEmailQueueHealth, queueEmail } from './queue'
export { sendEmailViaProvider, updateSupabaseEmailStatus } from './sender'
export { emailGateway, EmailGatewayService } from './service'
export {
  buildDigestEmailText,
  buildNewDocumentEmailText,
  buildNotificationEmailText
} from './templates'
export type { UnsubscribeLinks } from '@docs.plus/email-templates'
export {
  buildListUnsubscribeHeaders,
  getEmailSubject,
  renderDigestEmail,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from '@docs.plus/email-templates'
