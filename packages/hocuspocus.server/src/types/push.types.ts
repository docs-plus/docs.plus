/**
 * Push Notification Types
 *
 * Types for the push notification gateway service.
 */

/**
 * Push notification request payload from Supabase trigger
 */
export interface PushNotificationRequest {
  // Identifiers
  user_id: string
  notification_id: string
  // Raw data - service worker formats the display
  type: string
  sender_name?: string
  sender_avatar?: string
  message_preview?: string
  action_url?: string
  channel_id?: string
}

/**
 * Push subscription from database
 */
export interface PushSubscription {
  id: string
  user_id: string
  device_id: string
  device_name?: string
  platform: 'web' | 'ios' | 'android'
  push_credentials: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
  is_active: boolean
  failed_count: number
  last_error?: string
  last_used_at?: string
  created_at: string
  updated_at: string
}

/**
 * Result of sending a push notification
 */
export interface PushSendResult {
  success: boolean
  sent: number
  total: number
  results?: Array<{
    success: boolean
    id: string
    error?: string
  }>
  error?: string
}

/**
 * Push gateway health status
 */
export interface PushGatewayHealth {
  configured: boolean
  vapid_subject: string | null
  queue_connected: boolean
  pending_jobs: number
  failed_jobs: number
  sent_last_hour: number
}

/**
 * Push job data for BullMQ queue
 */
export interface PushJobData {
  type: 'notification'
  payload: PushNotificationRequest
  created_at: string
}

