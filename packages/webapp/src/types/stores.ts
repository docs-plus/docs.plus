export type CommentMessageMemory = {
  content: string
  html: string
  text: string
  channel_id: string
  workspace_id: string
  user: any
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
  userPickingEmoji?: boolean
  replyMessageMemory?: any | null
  commentMessageMemory?: CommentMessageMemory | null
  editMessageMemory?: any | null
  forwardMessageMemory?: any | null
  unreadMessage?: boolean
  lastReadMessageId?: string | null
  lastReadMessageTimestamp?: Date
  totalMsgSinceLastRead?: number
  member_count?: number
}
