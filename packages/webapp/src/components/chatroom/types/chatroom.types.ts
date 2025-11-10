export interface ChatroomVariant {
  mobile: 'mobile'
  desktop: 'desktop'
}

export interface ChatroomProps {
  variant?: keyof ChatroomVariant
  className?: string
  children: React.ReactNode
}

export interface DialogConfig {
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

export interface ChatroomContextValue {
  channelId: string
  variant: keyof ChatroomVariant
  error: string | null
  isChannelDataLoaded: boolean
  isDbSubscriptionReady: boolean
  // Dialog API
  openDialog: (content: React.ReactNode, config?: DialogConfig) => void
  closeDialog: () => void
  isDialogOpen: boolean
  initLoadMessages: boolean
}

// src/components/chatroom/types/message.types.ts
export interface Message {
  id: string
  content: string
  authorId: string
  channelId: string
  createdAt: string
  updatedAt?: string
  isEdited: boolean
  isBookmarked: boolean
  replyToId?: string
  threadId?: string
  type: 'text' | 'emoji' | 'system'
  reactions: MessageReaction[]
  readBy: string[]
  replyCount: number
}

export interface MessageReaction {
  emoji: string
  users: string[]
  count: number
}

export interface MessageCardProps {
  messageId: string
  variant?: keyof ChatroomVariant
  className?: string
  children: React.ReactNode
}
