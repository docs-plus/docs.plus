/**
 * File-based email templates powered by eta: `.eta` files in /templates/, compiled
 * to JS functions on first use and cached. Supabase auth templates (magic-link,
 * change-email-address) use Go template syntax, live in
 * apps/hocuspocus.server/templates/, and are NOT managed by this engine.
 */

export {
  buildListUnsubscribeHeaders,
  getEmailSubject,
  renderDigestEmail,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from './src/engine'

export type { UnsubscribeLinks } from './src/helpers'
export { templateHelpers } from './src/helpers'
export { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './src/tokens'
