import { Database } from './supabase'
export * from './history'
interface LinkItem {
  url: string
  type: string
  metadata: {
    title?: string
    description?: string
    icon?: string
    socialBanner?: string
    socialBannerSize?: {
      width: number
      height: number
    }
    themeColor?: string
  }
}

interface ProfileData {
  bio?: string
  linkTree?: LinkItem[]
}

export type { TChannelSettings } from './stores'
export type { Database }
export type Channel =
  | (Database['public']['Tables']['channels']['Row'] & {
      member_count?: number
      unread_message_count?: number
      count?: {
        message_count: number
      }
    })
  | null
export type Profile = Omit<Database['public']['Tables']['users']['Row'], 'profile_data'> & {
  profile_data?: ProfileData
  channelId?: string | null
}
export type ProfileUpdate = Omit<
  Database['public']['Tables']['users']['Update'],
  'profile_data'
> & {
  profile_data?: ProfileData
}

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

export type TTab = 'All' | 'Mentions' | 'Archived'
