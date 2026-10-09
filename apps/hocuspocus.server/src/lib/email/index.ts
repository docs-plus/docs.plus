export type {
  BounceType,
  DigestChannel,
  DigestDocument,
  DigestEmailRequest,
  DigestNotification,
  EmailBounceEvent,
  EmailFooter,
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
export { createEmailWorker, getEmailDlqDepth, getEmailQueueHealth, queueEmail } from './queue'
export { updateSupabaseEmailStatus } from './sender'
export { emailGateway, EmailGatewayService } from './service'
export {
  buildDigestEmail,
  buildListUnsubscribeHeaders,
  buildNewDocumentEmailText,
  buildNotificationEmailText,
  getEmailSubject,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from '@docs.plus/email-templates'
