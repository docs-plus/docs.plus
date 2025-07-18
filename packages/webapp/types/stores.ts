export type commentMessageMemory = {
  content: string
  html: string
  text: string
  channel_id: string
  workspace_id: string
  user: any
}

export type TChannelSettings = {
  name: any
  channelId?: string | null
  channelInfo?: any
  isUserChannelMember?: boolean
  isUserChannelOwner?: boolean
  isUserChannelAdmin?: boolean
  userPickingEmoji?: boolean
  replyMessageMemory?: any
  commentMessageMemory?: commentMessageMemory
  messageDraftMemory?: any
  editMessageMemory?: any
  forwardMessageMemory?: any
  unreadMessage?: boolean
  scrollPage?: number
  scrollPageOffset?: number
  lastReadMessageId?: string | null
  lastReadMessageTimestamp?: Date
  totalMsgSinceLastRead?: number
  totalMsgSincLastRead?: number
  member_count?: number
}
