/**
 * eta templates in /templates/. Supabase auth templates use Go syntax and live
 * in apps/hocuspocus.server/templates/ — this engine does not manage them.
 */

export {
  buildListUnsubscribeHeaders,
  countDigestItems,
  getEmailSubject,
  renderDigestEmail,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from './src/engine'
export type { UnsubscribeLinks } from './src/helpers'
export { templateHelpers } from './src/helpers'
export { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './src/tokens'
