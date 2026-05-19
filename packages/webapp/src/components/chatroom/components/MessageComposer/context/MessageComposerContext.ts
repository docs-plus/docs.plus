import { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory } from '@types'
import { createContext } from 'react'

export interface MessageComposerContextType {
  editor: Editor | null
  text: string
  html: string
  replyMessageMemory: ComposerMessageMemory | null | undefined
  editMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  setEditMsgMemory: (channelId: string, value: ComposerMessageMemory | null) => void
  setReplyMsgMemory: (channelId: string, value: ComposerMessageMemory | null) => void
  setCommentMsgMemory: (channelId: string, value: CommentMessageMemory | null) => void
  contextType: 'reply' | 'edit' | 'comment' | null
  showFormattingToolbar: boolean
  toggleToolbar: () => void
  submitMessage: (e?: { preventDefault?: () => void }) => Promise<void>
  isSubmittable: () => boolean
  /** Send affordance: true when editor has non-whitespace content (incl. anon sign-in path). */
  canPressSend: () => boolean
  editorRef: React.RefObject<HTMLDivElement | null>
  isEmojiOnly: boolean
}

export const MessageComposerContext = createContext<MessageComposerContextType | undefined>(
  undefined
)
