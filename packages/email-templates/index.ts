/**
 * eta templates in /templates/. Supabase auth templates use Go syntax and live
 * in apps/hocuspocus.server/templates/ — this engine does not manage them.
 */

export {
  buildListUnsubscribeHeaders,
  countDigestItems,
  getEmailSubject,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from './src/engine'
export type { UnsubscribeLinks } from './src/helpers'
export type { DigestEmail } from './src/templates'
export {
  buildDigestEmail,
  buildNewDocumentEmailText,
  buildNotificationEmailText
} from './src/templates'
export { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './src/tokens'
export type {
  DigestChangedSection,
  DigestChannel,
  DigestContentChanges,
  DigestDocument,
  DigestFrequency,
  DigestNotification,
  NotificationType
} from './src/types'
