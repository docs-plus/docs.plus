/**
 * Document Notification Emails
 *
 * Sends notification emails when new documents are created.
 * Uses the shared template system for consistent design.
 */

import type { EmailJobData, GenericEmailRequest } from '../../types/email.types'
import { emailLogger } from '../logger'
import { sendEmailViaProvider } from './sender'
import { buildNewDocumentEmailHtml, buildNewDocumentEmailText } from './templates'

interface NewDocumentEmailParams {
  documentId: string
  documentName: string
  slug: string
  creatorEmail?: string
  creatorId?: string
  creatorName?: string
  creatorAvatarUrl?: string
  createdAt: Date
}

/**
 * Sends notification email when a new document is created
 * Only sends in production environment to avoid noise during development
 */
export const sendNewDocumentNotification = async (
  params: NewDocumentEmailParams
): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'production') {
    emailLogger.debug('Skipping new document notification (non-production environment)')
    return false
  }

  const notificationEmails = process.env.NEW_DOCUMENT_NOTIFICATION_EMAILS

  if (!notificationEmails) {
    emailLogger.debug('NEW_DOCUMENT_NOTIFICATION_EMAILS not configured, skipping notification')
    return false
  }

  // Parse comma-separated email list
  const recipients = notificationEmails
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && email.includes('@'))

  if (recipients.length === 0) {
    emailLogger.warn('No valid emails in NEW_DOCUMENT_NOTIFICATION_EMAILS')
    return false
  }

  const appUrl = process.env.APP_URL || 'https://docs.plus'
  const documentUrl = `${appUrl}/${params.slug}`
  const creatorDisplay = params.creatorName || params.creatorEmail || 'Anonymous'

  const html = buildNewDocumentEmailHtml({
    documentName: params.documentName,
    documentUrl,
    creatorName: creatorDisplay,
    creatorEmail: params.creatorEmail,
    creatorAvatarUrl: params.creatorAvatarUrl,
    createdAt: params.createdAt.toISOString(),
    slug: params.slug,
    documentId: params.documentId
  })

  const text = buildNewDocumentEmailText({
    documentName: params.documentName,
    documentUrl,
    creatorName: creatorDisplay,
    creatorEmail: params.creatorEmail,
    slug: params.slug,
    documentId: params.documentId,
    createdAt: params.createdAt.toISOString()
  })

  const jobData: EmailJobData = {
    type: 'generic',
    payload: {
      to: recipients,
      subject: `New Document: ${params.documentName}`,
      html,
      text
    } as GenericEmailRequest,
    created_at: new Date().toISOString()
  }

  const result = await sendEmailViaProvider(jobData)
  return result.success
}
