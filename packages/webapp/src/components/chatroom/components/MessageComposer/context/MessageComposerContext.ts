import { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory } from '@types'
import { createContext } from 'react'

export interface MessageComposerContextType {
  editor: Editor | null
  replyMessageMemory: ComposerMessageMemory | null | undefined
  editMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  setEditMsgMemory: (channelId: string, value: ComposerMessageMemory | null) => void
  setReplyMsgMemory: (channelId: string, value: ComposerMessageMemory | null) => void
  setCommentMsgMemory: (channelId: string, value: CommentMessageMemory | null) => void
  showFormattingToolbar: boolean
  toggleToolbar: () => void
  submitMessage: (e?: { preventDefault?: () => void }) => Promise<void>
  /** Reactive send affordance: true when editor has non-whitespace content. */
  canSend: boolean
  isMobile: boolean
  editorRef: React.RefObject<HTMLDivElement | null>
  isEmojiOnly: boolean
}

export const MessageComposerContext = createContext<MessageComposerContextType | undefined>(
  undefined
)
