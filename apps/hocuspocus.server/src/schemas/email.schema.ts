import { z } from 'zod'

// =============================================================================
// Email Notification Schemas
// =============================================================================

export const sendNotificationEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  queue_id: z.string().uuid('Invalid queue_id format'),
  notification_type: z.string().max(50).optional(),
  subject: z.string().max(200).optional(),
  sender_name: z.string().max(100).optional(),
  sender_avatar: z.string().url().optional().nullable(),
  message_preview: z.string().max(1000).optional(),
  action_url: z.string().max(500).optional(),
  channel_name: z.string().max(100).optional(),
  document_title: z.string().max(200).optional(),
  unsubscribe_token: z.string().optional()
})

export const sendGenericEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  html: z.string().min(1, 'HTML content is required').max(100000),
  text: z.string().max(50000).optional(),
  replyTo: z.string().email().optional()
})

export const sendDigestEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  frequency: z.enum(['daily', 'weekly']),
  documents: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string().optional(),
        update_count: z.number().optional(),
        last_activity: z.string().optional()
      })
    )
    .min(1, 'At least one document is required'),
  user_name: z.string().max(100).optional(),
  unsubscribe_token: z.string().optional()
})

export const unsubscribeQuerySchema = z.object({
  token: z.string().min(1, 'Token is required')
})

// =============================================================================
// Bounce Webhook Schema
// =============================================================================

export const emailBounceSchema = z.object({
  email: z.string().email('Invalid email address'),
  bounce_type: z.enum(['hard', 'soft', 'complaint']),
  provider: z.string().max(50).optional(),
  reason: z.string().max(1000).optional()
})

// =============================================================================
// Template Preview Schema
// =============================================================================

export const templatePreviewSchema = z.object({
  type: z.enum(['notification', 'digest'])
})

// =============================================================================
// Export Types
// =============================================================================

export type SendNotificationEmailInput = z.infer<typeof sendNotificationEmailSchema>
export type SendGenericEmailInput = z.infer<typeof sendGenericEmailSchema>
export type SendDigestEmailInput = z.infer<typeof sendDigestEmailSchema>
export type EmailBounceInput = z.infer<typeof emailBounceSchema>
