/**
 * @docs.plus/email-templates
 *
 * Extracted, file-based email templates powered by eta (https://eta.js.org).
 *
 * Templates are .eta files in /templates/ — compiled to native JS functions
 * on first use, then cached. Subsequent renders are plain function calls.
 *
 * Supabase auth templates (magic-link.html, change-email-address.html) use
 * Go template syntax and live in packages/hocuspocus.server/templates/ —
 * they are NOT managed by this engine.
 *
 * @example
 * ```ts
 * import { renderNotificationEmail, getEmailSubject } from '@docs.plus/email-templates'
 *
 * const html = renderNotificationEmail({
 *   recipientName: 'Jane',
 *   senderName: 'John',
 *   notificationType: 'mention',
 *   messagePreview: 'Hey @Jane, check the API docs',
 *   actionUrl: 'https://docs.plus/api-docs?chatroom=general',
 * })
 * ```
 */

// Render functions
export {
  buildListUnsubscribeHeaders,
  getEmailSubject,
  renderDigestEmail,
  renderNewDocumentEmail,
  renderNotificationEmail,
  renderUnsubscribePage
} from './src/engine'

// Types & helpers (for consumers that need direct access)
export type { UnsubscribeLinks } from './src/helpers'
export { templateHelpers } from './src/helpers'
export { APP_NAME, APP_URL, COLORS, FONT_STACK, RADIUS, SPACING } from './src/tokens'
