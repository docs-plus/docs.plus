import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'

import type { JumpTarget } from '../hooks/useJumpTo'
import type { SendDraft } from '../hooks/useSendMessage'
import type { ChatItem } from './chat-items'

export interface ChatroomVariant {
  mobile: 'mobile'
  desktop: 'desktop'
}

export interface ChatroomProps {
  variant?: keyof ChatroomVariant
  className?: string
  children: React.ReactNode
  /** Deep-link entry point: scrolls to + flashes target message on mount. */
  deepLinkMessageId?: string | null
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
  // Dialog API
  openDialog: (content: React.ReactNode, config?: DialogConfig) => void
  closeDialog: () => void
  isDialogOpen: boolean
  initLoadMessages: boolean
  // v2 wiring exposed for MessageFeed shim + composer:
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>
  send: (draft: SendDraft) => Promise<void>
  retry: (clientId: string) => Promise<void>
  scrollToMessage: (messageId: string) => Promise<void>
  jumpTo: (target: JumpTarget) => Promise<void>
  snapToPresent: () => Promise<void>
  atBottom: boolean
  newCount: number
  hasMention: boolean
  /** Persisted unread count (channel_members.unread_message_count). */
  unreadCount: number
  onAtBottomChange: (atBottom: boolean) => void
  /** Fired with the bottom-most fully-visible item index for read-cursor advance. */
  onLastVisibleIndexChange: (index: number) => void
  // Older-message pagination wired from useChannelMessages through to
  // ChatList; the Virtuoso surface owns the top-edge trigger.
  loadOlder: () => Promise<void> | void
  hasMoreOlder: boolean
  loadingOlder: boolean
  currentUserId: string | null
}
