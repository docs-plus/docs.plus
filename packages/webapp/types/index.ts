import { Database } from './supabase'
export * from './history'
export * from './tiptap'
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

export type TMsgRow = Database['public']['Tables']['messages']['Row'] & {
  metadata: any | null
  user_details: Profile | null
  is_bookmarked?: boolean
  bookmark_id?: number | null
  bookmark_created_at?: string | null
  bookmark_archived_at?: string | null
  bookmark_marked_at?: string | null
  bookmark_metadata?: any | null
  isGroupEnd: boolean
  isGroupStart: boolean
  isNewGroupById: boolean
  replied_message_details: {
    message: TMsgRow
    user: Profile
  }
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

export type TFToggleMessageBookmark = Database['public']['Functions']['toggle_message_bookmark']

export type TSendMsgeArgs = {
  content: TMsgRow['content']
  channel_id: TMsgRow['channel_id']
  user_id: TMsgRow['user_id']
  html: TMsgRow['html']
  reply_to_message_id: TMsgRow['reply_to_message_id']
}

export type TSendCommentArgs = {
  content: TMsgRow['content']
  channel_id: TMsgRow['channel_id']
  user_id: TMsgRow['user_id']
  html: TMsgRow['html']
  comment: {
    content: string
    html: string
  }
}

export type TUpdateMsgArgs = {
  content: TMsgRow['content']
  html: TMsgRow['html']
  id: TMsgRow['id']
}

export type TSendThreadMsgArgs = Database['public']['Functions']['create_thread_message']['Args']
