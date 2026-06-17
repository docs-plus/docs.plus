import type { CommentAnchorV1 } from './comment'
import type { Profile } from './domain'

export type CommentMessageMemory = {
  anchor: CommentAnchorV1
  channel_id: string
  workspace_id: string | undefined
  user: Profile | null
}

/** Reply/edit composer context — subset of message row fields the UI needs. */
export type ComposerMessageMemory = {
  id?: string
  channel_id?: string
  content?: string
  html?: string | null
  user_details?: { fullname?: string; username?: string }
}

export type TChannelSettings = {
  name: any
  channelId?: string | null
  channelInfo?: any
  isUserChannelMember?: boolean
  isUserChannelOwner?: boolean
  isUserChannelAdmin?: boolean
  replyMessageMemory?: any | null
  commentMessageMemory?: CommentMessageMemory | null
  editMessageMemory?: any | null
  member_count?: number
}
