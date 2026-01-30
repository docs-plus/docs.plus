import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/postgrest-js'
import { Editor } from '@tiptap/react'
import { TSendCommentArgs, TSendMsgeArgs, TSendThreadMsgArgs,TUpdateMsgArgs } from '@types'
import { createContext } from 'react'

export interface MessageComposerContextType {
  sendMsg: (args: TSendMsgeArgs) => Promise<PostgrestResponse<any> | PostgrestSingleResponse<any>>
  sendComment: (
    args: TSendCommentArgs
  ) => Promise<PostgrestResponse<any> | PostgrestSingleResponse<any>>
  updateMsg: (
    args: TUpdateMsgArgs
  ) => Promise<PostgrestResponse<any> | PostgrestSingleResponse<any>>
  sendThreadMsg: (
    args: TSendThreadMsgArgs
  ) => Promise<PostgrestResponse<any> | PostgrestSingleResponse<any>>
  isSendingMsg: boolean
  isSendingComment: boolean
  isUpdatingMsg: boolean
  isSendingThreadMsg: boolean
  loading: boolean
  editor: Editor | null
  text: string
  html: string
  replyMessageMemory: any
  editMessageMemory: any
  commentMessageMemory: any
  setEditMsgMemory: (channelId: string, value: any) => void
  setReplyMsgMemory: (channelId: string, value: any) => void
  setCommentMsgMemory: (channelId: string, value: any) => void
  contextType: 'reply' | 'edit' | 'comment' | null
  isToolbarOpen: boolean
  toggleToolbar: () => void
  submitMessage: (e?: any) => Promise<void>
  editorRef: React.RefObject<HTMLDivElement | null>
  messageDraftMemory: {
    text: string | null
    html: string | null
  } | null
  isEmojiOnly: boolean
}

export const MessageComposerContext = createContext<MessageComposerContextType | undefined>(
  undefined
)
