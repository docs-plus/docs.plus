// The digest payload shape is declared once, in the package that renders it.
import type { DigestDocument, DigestFrequency, NotificationType } from '@docs.plus/email-templates'

import type { EmailDlqDisposition } from '../lib/email/dlqDisposition'
import type { EmailErrorKind } from '../lib/email/providers/types'

export type {
  DigestChangedSection,
  DigestChangeRun,
  DigestChannel,
  DigestContentChanges,
  DigestDocument,
  DigestFrequency,
  DigestNotification,
  EmailFooter,
  NotificationType
} from '@docs.plus/email-templates'

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
  /** Email is `off`: settle the rows 'skipped', never retry. */
  skipped?: boolean
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
  /** Absent on an entry written before failures were typed; the drain leaves those alone. */
  failureKind?: EmailErrorKind
  /** The provider's own code, verbatim. Absent when the error was not the provider's. */
  failureCode?: string
  failedAt: string
}

/** `inline` happens only without Redis. That send is final: nothing retries it. */
export type QueuedEmail = { jobId: string } | { inline: EmailResult }

export interface EmailDlqEntry {
  id: string
  failureKind: EmailDLQData['failureKind']
  disposition: EmailDlqDisposition
}

export interface EmailDlqDrainResult {
  entries: EmailDlqEntry[]
  /** The whole parked queue, which can be more than one pass reads. */
  depth: number
}

// Digest notifications grouped by document → channel
export interface DigestEmailRequest {
  to: string
  recipient_name: string
  recipient_id: string
  frequency: DigestFrequency
  documents: DigestDocument[]
  period_end: string
  /** The email_queue rows this mail settles once the provider answers. */
  queue_ids?: string[]
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
