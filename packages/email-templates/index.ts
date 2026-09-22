/**
 * eta templates in /templates/. Supabase auth templates use Go syntax and live
 * in apps/hocuspocus.server/templates/ — this engine does not manage them.
 */

export { DEFAULT_DIGEST_MAX_BYTES, fitDigestDocuments } from './src/digestFit'
export {
  buildListUnsubscribeHeaders,
  countDigestItems,
  getEmailSubject,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from './src/engine'
export type { EmailFooter } from './src/helpers'
export type { DigestEmail } from './src/templates'
export {
  buildDigestEmail,
  buildNewDocumentEmailText,
  buildNotificationEmailText
} from './src/templates'
export { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './src/tokens'
export type {
  DigestChangedSection,
  DigestChangeRun,
  DigestChannel,
  DigestContentChanges,
  DigestDocument,
  DigestFrequency,
  DigestHeadingChat,
  DigestNotification,
  NotificationType
} from './src/types'
