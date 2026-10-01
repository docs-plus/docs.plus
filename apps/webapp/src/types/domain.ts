import { Database } from './supabase'

export enum LinkType {
  Email = 'email',
  Social = 'social',
  Simple = 'simple',
  Phone = 'phone'
}

export interface LinkMetadata {
  title?: string
  description?: string
  icon?: string
  themeColor?: string
}

export interface LinkItem {
  url: string
  type: LinkType
  metadata?: LinkMetadata
}

export interface ProfileData {
  bio?: string
  linkTree?: LinkItem[]
}

/** What a chat member is doing now, other than typing. */
export type PresenceActivity = 'choosingEmoji' | 'recordingVoice'

/** Payload of the `typingIndicator` workspace broadcast. Old clients ignore unknown types. */
export type TypingIndicatorPayload = {
  type: 'startTyping' | 'stopTyping' | 'startActivity' | 'stopActivity'
  /** Set only on `startActivity` and `stopActivity`. */
  activity?: PresenceActivity
  user: { id: string }
}

// No client can read notification_preferences; get_notification_preferences() serves the owner.
export type Profile = Omit<
  Database['public']['Tables']['users']['Row'],
  'profile_data' | 'notification_preferences'
> & {
  profile_data?: ProfileData
  channelId?: string | null
  /** Client-only, like `channelId`. Never put it in `status`: that is the Postgres enum `user_status`. */
  activity?: PresenceActivity
  display_name?: string | null
  avatar_url?: string | null
  fullname?: string | null
}

export type ProfileUpdate = Omit<
  Database['public']['Tables']['users']['Update'],
  'profile_data' | 'notification_preferences'
> & {
  profile_data?: ProfileData
}

export type Channel =
  | (Database['public']['Tables']['channels']['Row'] & {
      member_count?: number
      unread_message_count?: number
      count?: {
        message_count: number
      }
    })
  | null

export type TNotification = {
  id: string
  type: string
  sender: {
    id: string
    username: string
    full_name?: string | null
    avatar_url: string | null
    display_name?: string | null
    avatar_updated_at: string | null
  }
  readed_at: string | null
  channel_id: string | null
  created_at: string
  message_id: string | null
  message_preview: string
  /** Absolute link for carrier rows such as `content_change`; chat rows carry none.
   *  Required, not optional: all three fetch RPCs select it, so an absent key
   *  would mean a query forgot the column rather than a row without a link. */
  action_url: string | null
}

export type TNotificationSummary = {
  unread_count: number
  unread_mention_count: number
  last_unread: TNotification[]
  last_unread_mention: TNotification[]
}

export type TTab = 'Unread' | 'Mentions' | 'Read'

export type TBookmarkTab = 'in progress' | 'archive' | 'read'

export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never'

export interface EmailBounceInfo {
  email: string
  reason: string
  bounced_at: string
}

export interface NotificationPreferences {
  push_mentions?: boolean
  push_replies?: boolean
  push_reactions?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone?: string
  email_enabled?: boolean
  email_mentions?: boolean
  email_replies?: boolean
  email_reactions?: boolean
  email_content_changes?: boolean
  email_frequency?: EmailFrequency
  // `null` is the "clear-on-re-enable" wire sentinel; the FE truthy-check
  // at the banner site hides JSON-null.
  email_bounce_info?: EmailBounceInfo | null
}
