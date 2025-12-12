import { emailLogger } from './logger'
import nodemailer from 'nodemailer'

interface SendEmailParams {
  to: string[]
  subject: string
  html: string
  text?: string
}

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
 * Sends email using Nodemailer (SMTP)
 * @see https://nodemailer.com/
 *
 */
export const sendEmail = async (params: SendEmailParams): Promise<boolean> => {
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const fromEmail = process.env.EMAIL_FROM || smtpUser || 'noreply@docs.plus'

  if (!smtpHost || !smtpUser || !smtpPass) {
    emailLogger.warn(
      'SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email notifications'
    )
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })

    const info = await transporter.sendMail({
      from: fromEmail,
      to: params.to.join(', '),
      subject: params.subject,
      text: params.text,
      html: params.html
    })

    emailLogger.info({ messageId: info.messageId, to: params.to }, 'Email sent via SMTP')
    return true
  } catch (err) {
    emailLogger.error({ err }, 'Error sending email via SMTP')
    return false
  }
}

/**
 * Sends notification email when a new document is created
 */
export const sendNewDocumentNotification = async (
  params: NewDocumentEmailParams
): Promise<boolean> => {
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

  // Build creator info HTML if we have user details
  const hasCreator = params.creatorEmail || params.creatorName
  const creatorDisplay = params.creatorName || params.creatorEmail || 'Anonymous'
  const creatorHtml = hasCreator
    ? `
    <div style="display: flex; align-items: center; padding: 15px; background: #fff; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
      ${
        params.creatorAvatarUrl
          ? `<img src="${params.creatorAvatarUrl}" alt="Creator" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 15px; object-fit: cover;">`
          : `<div style="width: 48px; height: 48px; border-radius: 50%; margin-right: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">${creatorDisplay.charAt(0).toUpperCase()}</div>`
      }
      <div>
        <div style="font-weight: 600; color: #333;">${params.creatorName || 'User'}</div>
        ${params.creatorEmail ? `<div style="font-size: 13px; color: #6c757d;">${params.creatorEmail}</div>` : ''}
        ${params.creatorId ? `<div style="font-size: 11px; color: #adb5bd; font-family: monospace;">ID: ${params.creatorId}</div>` : ''}
      </div>
    </div>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">📄 New Document Created</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
    ${hasCreator ? `<h3 style="margin: 0 0 15px 0; font-size: 14px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">Created By</h3>${creatorHtml}` : ''}

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; font-weight: 600; width: 140px;">Document ID</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; font-family: monospace; font-size: 14px;">${params.documentId}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; font-weight: 600;">Name</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">${params.documentName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; font-weight: 600;">Slug</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;"><code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px;">${params.slug}</code></td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-weight: 600;">Created At</td>
        <td style="padding: 10px 0;">${params.createdAt.toISOString()}</td>
      </tr>
    </table>

    <div style="margin-top: 25px; text-align: center;">
      <a href="${documentUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
        View Document →
      </a>
    </div>
  </div>

  <p style="color: #6c757d; font-size: 12px; text-align: center; margin-top: 20px;">
    This is an automated notification from docs.plus
  </p>
</body>
</html>
`

  const creatorText = hasCreator
    ? `\nCreated By: ${params.creatorName || 'User'}${params.creatorEmail ? ` (${params.creatorEmail})` : ''}${params.creatorId ? `\nUser ID: ${params.creatorId}` : ''}\n`
    : ''

  const text = `
New Document Created
${creatorText}
Document ID: ${params.documentId}
Name: ${params.documentName}
Slug: ${params.slug}
Created At: ${params.createdAt.toISOString()}

View Document: ${documentUrl}
`

  return sendEmail({
    to: recipients,
    subject: `📄 New Document: ${params.documentName}`,
    html,
    text
  })
}
