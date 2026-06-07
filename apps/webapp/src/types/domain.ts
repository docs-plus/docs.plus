/**
 * Domain types - Core business entities
 * Types representing real-world concepts in the application
 */

import { Database } from './supabase'

// --- Link types ---

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

// --- Profile types ---

export interface ProfileData {
  bio?: string
  linkTree?: LinkItem[]
}

export type Profile = Omit<Database['public']['Tables']['users']['Row'], 'profile_data'> & {
  profile_data?: ProfileData
  channelId?: string | null
  display_name?: string | null
  avatar_url?: string | null
  fullname?: string | null
}

export type ProfileUpdate = Omit<
  Database['public']['Tables']['users']['Update'],
  'profile_data'
> & {
  profile_data?: ProfileData
}

// Channel types
export type Channel =
  | (Database['public']['Tables']['channels']['Row'] & {
      member_count?: number
      unread_message_count?: number
      count?: {
        message_count: number
      }
    })
  | null

// Notification types
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
  channel_id: string
  created_at: string
  message_id: string
  message_preview: string
}

export type TNotificationSummary = {
  unread_count: number
  unread_mention_count: number
  last_unread: TNotification[]
  last_unread_mention: TNotification[]
}

export type TTab = 'Unread' | 'Mentions' | 'Read'

// Bookmark tab labels — used by the bookmark panel UI and the chat-bookmark store.
export type TBookmarkTab = 'in progress' | 'archive' | 'read'
