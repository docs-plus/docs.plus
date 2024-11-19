export type TChannelSettings = {
  name: any
  channelId?: string | null
  channelInfo?: any
  isUserChannelMember?: boolean
  isUserChannelOwner?: boolean
  isUserChannelAdmin?: boolean
  userPickingEmoji?: boolean
  replayMessageMemory?: any
  commentMessageMemory?: any
  editMessageMemory?: any
  forwardMessageMemory?: any
  unreadMessage?: boolean
  scrollPage?: number
  scrollPageOffset?: number
  lastReadMessageId?: string | null
  lastReadMessageTimestamp?: Date
  totalMsgSinceLastRead?: number
  totalMsgSincLastRead?: number
} | null
