// Supported notification types (matches Supabase notifications.type)
export type NotificationType =
  'mention' | 'reply' | 'reaction' | 'message' | 'thread_message' | 'channel_event'

export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never'

export type EmailStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped'

export interface NotificationEmailRequest {
  queue_id: string

  to: string
  recipient_name: string
  recipient_id: string

  sender_name: string
  sender_id?: string
  sender_avatar_url?: string

  notification_type: NotificationType
  message_preview: string

  document_name?: string
  document_slug?: string
  channel_name?: string
  channel_id?: string
  action_url?: string

  created_at?: string
}

export interface GenericEmailRequest {
  to: string[]
  subject: string
  html: string
  text?: string
  reply_to?: string
  tags?: string[]
}

export interface EmailResult {
  success: boolean
  message_id?: string
  error?: string
  queue_id?: string
  deduplicated?: boolean // True if this was an idempotent skip
}

export interface EmailJobData {
  type: 'notification' | 'generic' | 'digest'
  payload: NotificationEmailRequest | GenericEmailRequest | DigestEmailRequest
  attempts?: number
  created_at: string
}

export interface EmailDLQData extends EmailJobData {
  originalJobId?: string
  failureReason: string
  failedAt: string
}

// Digest notifications grouped by document → channel
export interface DigestEmailRequest {
  to: string
  recipient_name: string
  recipient_id: string
  frequency: 'daily' | 'weekly'
  documents: DigestDocument[]
  period_start: string
  period_end: string
}

export interface DigestDocument {
  name: string
  slug: string
  url: string
  channels: DigestChannel[]
}

export interface DigestChannel {
  name: string
  id: string
  url: string
  notifications: DigestNotification[]
}

export interface DigestNotification {
  type: NotificationType
  sender_name: string
  sender_avatar_url?: string
  message_preview: string
  action_url: string
  created_at: string
}

export interface EmailGatewayHealth {
  smtp_configured: boolean
  queue_connected: boolean
  pending_jobs: number
  failed_jobs: number
  sent_last_hour: number
}

export interface EmailStatusCallback {
  queue_id: string
  status: EmailStatus
  sent_at?: string
  error_message?: string
}

export type BounceType = 'hard' | 'soft' | 'complaint'

export interface EmailBounceEvent {
  email: string
  bounce_type: BounceType
  provider?: string
  reason?: string
}
