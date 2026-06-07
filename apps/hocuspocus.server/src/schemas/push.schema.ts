import { z } from 'zod'

// =============================================================================
// Push Notification Schemas
// =============================================================================

export const sendPushSchema = z.object({
  user_id: z.string().uuid('Invalid user_id format'),
  notification_id: z.string().uuid('Invalid notification_id format'),
  type: z.string().min(1).max(50).optional(),
  sender_name: z.string().max(100).optional(),
  sender_avatar: z.string().url().optional().nullable(),
  message_preview: z.string().max(500).optional(),
  action_url: z.string().max(500).optional(),
  channel_id: z.string().uuid().optional().nullable()
})

// =============================================================================
// Export Types
// =============================================================================

export type SendPushInput = z.infer<typeof sendPushSchema>
