/**
 * eta (https://eta.js.org) compiles each `.eta` file in /templates/ to a cached JS
 * function on first render. Helpers reach templates as `it.h`; every body template
 * renders first and is then wrapped by base.eta.
 */

import { Eta } from 'eta'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { templateHelpers, type UnsubscribeLinks } from './helpers'
import { APP_NAME, APP_URL, COLORS, RADIUS } from './tokens'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '..', 'templates')

const eta = new Eta({
  views: TEMPLATES_DIR,
  cache: true,
  autoEscape: true, // <%=  %> auto-escapes HTML; use <%~ %> for pre-rendered HTML
  autoTrim: false // preserve whitespace (important for email HTML)
})

function baseData(extra: Record<string, unknown> = {}) {
  return {
    h: templateHelpers,
    year: new Date().getFullYear(),
    ...extra
  }
}

function renderWithLayout(
  templateName: string,
  data: Record<string, unknown>,
  footerHtml: string
): string {
  const bodyHtml = eta.render(templateName, baseData(data))
  return eta.render('base', baseData({ body: bodyHtml, footerHtml }))
}

export function renderNotificationEmail(params: {
  recipientName: string
  senderName: string
  notificationType: string
  messagePreview: string
  actionUrl: string
  senderAvatarUrl?: string
  documentName?: string
  channelName?: string
  unsubscribeLinks?: UnsubscribeLinks
}): string {
  const { unsubscribeLinks, notificationType, ...rest } = params
  const subject = getEmailSubject(notificationType, params.senderName)

  const footerHtml = templateHelpers.footerLinks(unsubscribeLinks, notificationType)

  return renderWithLayout('notification', { ...rest, notificationType, subject }, footerHtml)
}

export function renderDigestEmail(params: {
  recipientName: string
  frequency: 'daily' | 'weekly'
  documents: Array<{
    name: string
    slug: string
    url: string
    channels: Array<{
      name: string
      id: string
      url: string
      notifications: Array<{
        type: string
        sender_name: string
        sender_avatar_url?: string
        message_preview: string
        action_url: string
        created_at: string
      }>
    }>
  }>
  periodStart: string
  periodEnd: string
  unsubscribeLinks?: UnsubscribeLinks
}): string {
  const { documents, frequency, unsubscribeLinks, ...rest } = params
  const periodLabel = frequency === 'daily' ? 'today' : 'this week'

  const totalNotifications = documents.reduce(
    (sum, doc) => sum + doc.channels.reduce((cSum, ch) => cSum + ch.notifications.length, 0),
    0
  )

  const digestLinks: UnsubscribeLinks = {
    ...unsubscribeLinks,
    unsubscribe_all: unsubscribeLinks?.unsubscribe_digest || unsubscribeLinks?.unsubscribe_all
  }
  const footerHtml = templateHelpers.footerLinks(digestLinks)

  return renderWithLayout(
    'digest',
    {
      ...rest,
      frequency,
      documents,
      totalNotifications,
      periodLabel,
      notificationsUrl: `${APP_URL}/notifications`
    },
    footerHtml
  )
}

export function renderNewDocumentEmail(params: {
  documentName: string
  documentUrl: string
  creatorName: string
  creatorEmail?: string
  creatorAvatarUrl?: string
  createdAt: string
  slug: string
  documentId: string
}): string {
  const footerHtml = `
    <a href="${APP_URL}" style="color: ${COLORS.primary}; text-decoration: none;">Go to ${APP_NAME}</a>
  `
  return renderWithLayout('new-document', params, footerHtml)
}

/** A standalone HTML page, not an email — so no base layout. */
export function renderUnsubscribePage(params: {
  success: boolean
  title: string
  message: string
  email?: string
  showManageLink?: boolean
  showUndoLink?: boolean
  token?: string
}): string {
  const actions: string[] = []

  if (params.showManageLink) {
    actions.push(
      `<a href="${APP_URL}/settings/notifications" style="display: inline-block; background: ${COLORS.primary}; color: ${COLORS.white}; text-decoration: none; padding: 12px 24px; border-radius: ${RADIUS.md}; font-size: 14px; font-weight: 500; margin: 8px;">Manage Preferences</a>`
    )
  }

  if (params.showUndoLink && params.token) {
    actions.push(
      `<a href="${APP_URL}" style="display: inline-block; background: ${COLORS.white}; color: ${COLORS.primary}; text-decoration: none; padding: 12px 24px; border-radius: ${RADIUS.md}; font-size: 14px; font-weight: 500; border: 1px solid ${COLORS.primary}; margin: 8px;">Go to ${APP_NAME}</a>`
    )
  }

  return eta.render('unsubscribe', {
    ...params,
    appName: APP_NAME,
    appUrl: APP_URL,
    actions
  })
}

export function getEmailSubject(type: string, senderName: string): string {
  const name = senderName || 'Someone'

  switch (type) {
    case 'mention':
      return `${name} mentioned you`
    case 'reply':
      return `${name} replied to your message`
    case 'reaction':
      return `${name} reacted to your message`
    case 'thread_message':
      return `${name} replied in a thread`
    case 'message':
      return `${name} sent a message`
    case 'channel_event':
      return `${name} made an announcement`
    default:
      return 'New notification'
  }
}

/** One-click List-Unsubscribe headers per RFC 8058. */
export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  }
}
