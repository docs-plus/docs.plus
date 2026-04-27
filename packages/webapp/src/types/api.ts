/**
 * API types - Request/Response types for API operations
 * Types used for API function parameters and return values
 */

import { Profile } from './domain'
import { Database } from './supabase'

// Message types
export type TMsgRow = Database['public']['Tables']['messages']['Row'] & {
  metadata: unknown | null
  user_details: Profile | null
  is_bookmarked?: boolean
  bookmark_id?: number | null
  bookmark_created_at?: string | null
  bookmark_archived_at?: string | null
  bookmark_marked_at?: string | null
  bookmark_metadata?: unknown | null
  isGroupEnd: boolean
  isGroupStart: boolean
  isNewGroupById: boolean
  replied_message_details: {
    message: TMsgRow
    user: Profile
  }
}

// API request types
export type TSendMessageArgs = {
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

// Database function types
export type TFToggleMessageBookmark = Database['public']['Functions']['toggle_message_bookmark']

// Bookmarks RPC

type TUserDetails = {
  id: string
  username: string
  fullname: string
  avatar_url: string | null
  avatar_updated_at: string | null
}

export type TBookmarkWithMessage = {
  bookmark_id: number
  bookmark_created_at: string
  bookmark_updated_at: string
  bookmark_archived_at: string | null
  bookmark_marked_at: string | null
  bookmark_metadata: Record<string, any>
  message_id: string
  message_content: string
  message_html: string
  message_created_at: string
  message_user_id: string
  message_channel_id: string
  message_type: string
  user_details: TUserDetails
  channel_name: string
  channel_slug: string
  workspace_id: string
  workspace_name: string
  workspace_slug: string
}
