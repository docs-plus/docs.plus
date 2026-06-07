/**
 * Email Gateway Types
 *
 * Single source of truth for all email-related types in the system.
 * This module defines the contract for the email gateway API.
 */

// Supported notification types (matches Supabase notifications.type)
export type NotificationType =
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'message'
  | 'thread_message'
  | 'channel_event'

// Email delivery frequency
export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never'

// Email job status
export type EmailStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped'

/**
 * Notification email request payload
 * Sent from Supabase to the email gateway
 */
export interface NotificationEmailRequest {
  // Queue reference (for status updates)
  queue_id: string

  // Recipient
  to: string
  recipient_name: string
  recipient_id: string

  // Sender
  sender_name: string
  sender_id?: string
  sender_avatar_url?: string

  // Notification details
  notification_type: NotificationType
  message_preview: string

  // Context (document/workspace and channel)
  document_name?: string
  document_slug?: string
  channel_name?: string
  channel_id?: string
  action_url?: string

  // Metadata
  created_at?: string
}

/**
 * Generic email request for custom emails
 */
export interface GenericEmailRequest {
  to: string[]
  subject: string
  html: string
  text?: string
  reply_to?: string
  tags?: string[]
}

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean
  message_id?: string
  error?: string
  queue_id?: string
  deduplicated?: boolean // True if this was an idempotent skip
}

/**
 * Email job data for BullMQ queue
 */
export interface EmailJobData {
  type: 'notification' | 'generic' | 'digest'
  payload: NotificationEmailRequest | GenericEmailRequest | DigestEmailRequest
  attempts?: number
  created_at: string
}

/**
 * Email Dead Letter Queue job data
 */
export interface EmailDLQData extends EmailJobData {
  originalJobId?: string
  failureReason: string
  failedAt: string
}

/**
 * Digest email request (for daily/weekly summaries)
 * Notifications are grouped by document → channel
 */
export interface DigestEmailRequest {
  to: string
  recipient_name: string
  recipient_id: string
  frequency: 'daily' | 'weekly'
  documents: DigestDocument[]
  period_start: string
  period_end: string
}

/**
 * Document/Workspace in a digest
 */
export interface DigestDocument {
  name: string
  slug: string
  url: string
  channels: DigestChannel[]
}

/**
 * Channel within a document
 */
export interface DigestChannel {
  name: string
  id: string
  url: string
  notifications: DigestNotification[]
}

/**
 * Individual notification in a digest
 */
export interface DigestNotification {
  type: NotificationType
  sender_name: string
  sender_avatar_url?: string
  message_preview: string
  action_url: string
  created_at: string
}

/**
 * Email gateway health status
 */
export interface EmailGatewayHealth {
  smtp_configured: boolean
  queue_connected: boolean
  pending_jobs: number
  failed_jobs: number
  sent_last_hour: number
}

/**
 * Webhook callback for email status updates
 */
export interface EmailStatusCallback {
  queue_id: string
  status: EmailStatus
  sent_at?: string
  error_message?: string
}

/**
 * Bounce event from email provider webhook
 */
export type BounceType = 'hard' | 'soft' | 'complaint'

export interface EmailBounceEvent {
  email: string
  bounce_type: BounceType
  provider?: string
  reason?: string
}
