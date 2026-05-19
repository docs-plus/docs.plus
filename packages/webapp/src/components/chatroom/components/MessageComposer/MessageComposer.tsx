import {
  readFormattingToolbarExpanded,
  writeFormattingToolbarExpanded
} from '@components/chatroom/components/MessageComposer/helpers/composerToolbarSession'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { EditorContent } from '@tiptap/react'
import type { TChannelSettings } from '@types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../ChatroomContext'
import {
  Actions,
  EmojiButton,
  MentionButton,
  SendButton,
  ToggleToolbarButton
} from './components/Actions'
import { Context } from './components/Context'
import CommentContext from './components/Context/CommentContext'
import EditContext from './components/Context/EditContext'
import ReplyContext from './components/Context/ReplyContext'
import { Input } from './components/Input'
import { DesktopLayout, Editor, MobileLayout } from './components/layouts'
import {
  BlockquoteButton,
  BoldButton,
  BulletListButton,
  CodeBlockButton,
  CodeButton,
  HyperlinkButton,
  ItalicButton,
  OrderedListButton,
  StrikethroughButton,
  Toolbar
} from './components/Toolbar'
import { MessageComposerContext } from './context/MessageComposerContext'
import { useComposerDraft } from './hooks/useComposerDraft'
import { useComposerSubmit } from './hooks/useComposerSubmit'
import { useTiptapEditor } from './hooks/useTiptapEditor'
import { MobileWrapper } from './Mobile'

const MessageComposer = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => {
  const { channelId, send: contextSend } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false)
  const setOrUpdateChatRoom = useChatStore((state) => state.setOrUpdateChatRoom)

  const setEditMsgMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplyMsgMemory = useChatStore((state) => state.setReplyMessageMemory)
  const setCommentMsgMemory = useChatStore((state) => state.setCommentMessageMemory)

  const submitRef = useRef<(() => void) | null>(null)

  const {
    editor,
    text,
    html,
    isEmojiOnly,
    setIsEmojiOnly,
    cancelPendingEditorDraftCapture,
    setDraftHydrated
  } = useTiptapEditor({
    onSubmit: () => submitRef.current?.(),
    workspaceId,
    channelId
  })

  const chatChannels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => chatChannels.get(channelId) ?? null,
    [chatChannels, channelId]
  )

  const { replyMessageMemory, editMessageMemory, commentMessageMemory } = channelSettings || {}

  const contextType = useMemo((): 'reply' | 'edit' | 'comment' | null => {
    if (replyMessageMemory) return 'reply'
    if (editMessageMemory) return 'edit'
    if (commentMessageMemory) return 'comment'
    return null
  }, [replyMessageMemory, editMessageMemory, commentMessageMemory])

  useComposerDraft({
    editor,
    workspaceId,
    channelId,
    editMessageMemory,
    replyMessageMemory,
    commentMessageMemory,
    setIsEmojiOnly,
    setDraftHydrated
  })

  useEffect(() => {
    if (!workspaceId || !channelId) return
    const expanded = readFormattingToolbarExpanded(workspaceId, channelId)
    setShowFormattingToolbar(expanded ?? false)
  }, [workspaceId, channelId])

  const { submitMessage, isSubmittable, canPressSend } = useComposerSubmit({
    channelId,
    workspaceId,
    user,
    editor,
    contextSend,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    setReplyMsgMemory,
    setEditMsgMemory,
    setCommentMsgMemory,
    cancelPendingEditorDraftCapture
  })

  useEffect(() => {
    submitRef.current = () => {
      void submitMessage()
    }
  }, [submitMessage])

  useEffect(() => {
    const firstChild = editorRef.current?.firstChild as HTMLElement | null
    firstChild?.setAttribute('inputmode', 'text')
    firstChild?.setAttribute('enterkeyhint', 'send')
  }, [editor])

  const toggleToolbar = useCallback(() => {
    setShowFormattingToolbar((prev) => {
      const next = !prev
      if (workspaceId && channelId) writeFormattingToolbarExpanded(workspaceId, channelId, next)
      return next
    })
    editor?.commands.focus()
  }, [workspaceId, channelId, editor])

  useEffect(() => {
    if (!editor) return
    setOrUpdateChatRoom('editorInstance', editor)
    if (editorRef.current) setOrUpdateChatRoom('editorRef', editorRef.current)
    return () => {
      setOrUpdateChatRoom('editorInstance', undefined)
      setOrUpdateChatRoom('editorRef', undefined)
    }
  }, [editor, setOrUpdateChatRoom])

  const contextValue = useMemo(
    () => ({
      editor,
      text,
      html,
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      setEditMsgMemory,
      setReplyMsgMemory,
      setCommentMsgMemory,
      contextType,
      showFormattingToolbar,
      toggleToolbar,
      submitMessage,
      isSubmittable,
      canPressSend,
      editorRef,
      isEmojiOnly
    }),
    [
      editor,
      text,
      html,
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      setEditMsgMemory,
      setReplyMsgMemory,
      setCommentMsgMemory,
      contextType,
      showFormattingToolbar,
      toggleToolbar,
      submitMessage,
      isSubmittable,
      canPressSend,
      isEmojiOnly
    ]
  )

  return (
    <MessageComposerContext.Provider value={contextValue}>
      <div className={twMerge('flex flex-col', className)}>{children}</div>
    </MessageComposerContext.Provider>
  )
}

export default MessageComposer

MessageComposer.EditorContent = EditorContent
MessageComposer.Toolbar = Toolbar
MessageComposer.BlockquoteButton = BlockquoteButton
MessageComposer.CodeButton = CodeButton
MessageComposer.HyperlinkButton = HyperlinkButton
MessageComposer.ItalicButton = ItalicButton
MessageComposer.OrderedListButton = OrderedListButton
MessageComposer.StrikethroughButton = StrikethroughButton
MessageComposer.BoldButton = BoldButton
MessageComposer.BulletListButton = BulletListButton
MessageComposer.CodeBlockButton = CodeBlockButton
MessageComposer.Context = Context
MessageComposer.ReplyContext = ReplyContext
MessageComposer.EditContext = EditContext
MessageComposer.CommentContext = CommentContext
MessageComposer.Actions = Actions
MessageComposer.EmojiButton = EmojiButton
MessageComposer.MentionButton = MentionButton
MessageComposer.SendButton = SendButton
MessageComposer.ToggleToolbarButton = ToggleToolbarButton
MessageComposer.Input = Input
MessageComposer.MobileWrapper = MobileWrapper
MessageComposer.MobileLayout = MobileLayout
MessageComposer.DesktopLayout = DesktopLayout
MessageComposer.Editor = Editor
