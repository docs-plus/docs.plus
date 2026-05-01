import { Profile } from './domain'
import type { MessageStatus } from './message'
import { Database } from './supabase'

export type TMsgRow = Omit<Database['public']['Tables']['messages']['Row'], 'metadata'> & {
  metadata: unknown | null
  user_details: Profile | null
  is_bookmarked?: boolean
  bookmark_id?: number | null
  bookmark_created_at?: string | null
  bookmark_archived_at?: string | null
  bookmark_marked_at?: string | null
  bookmark_metadata?: unknown | null
  replied_message_details?: {
    message: TMsgRow
    /**
     * Author of the replied-to message. Nullable because the row may
     * have been written optimistically before user-presence resolved
     * (e.g. on cold reload), and because the original author may have
     * been soft-deleted (`users.deleted_at`).
     */
    user: Profile | null
  }
  /** Local-only delivery state. Omitted means `sent`. */
  status?: MessageStatus
  /** Human-readable error from the last failed send attempt. */
  statusError?: string
}

/**
 * Render-time projection of `TMsgRow` carrying grouping flags.
 * Produced by `projectMessageGroups`. Never persisted.
 */
export type TGroupedMsgRow = TMsgRow & {
  isGroupStart: boolean
  isGroupEnd: boolean
  isNewGroupById: boolean
  isOwner: boolean
}

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

export type TFToggleMessageBookmark = Database['public']['Functions']['toggle_message_bookmark']

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
