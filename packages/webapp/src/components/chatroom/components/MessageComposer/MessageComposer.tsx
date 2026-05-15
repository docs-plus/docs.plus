import { sendCommentMessage, sendMessage, updateMessage } from '@api'
import SignInForm from '@components/auth/SignInForm'
import { showNotificationPrompt } from '@components/NotificationPromptCard'
import * as toast from '@components/toast'
import {
  clearComposerState,
  ComposerState,
  getComposerState,
  setComposerStateDebounced
} from '@db/messageComposerDB'
import { useApi } from '@hooks/useApi'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { EditorContent } from '@tiptap/react'
import type { TChannelSettings } from '@types'
import { chunkHtmlContent } from '@utils/chunkHtmlContent'
import { isOnlyEmoji } from '@utils/emojis'
import { sanitizeChunk, sanitizeMessageContent } from '@utils/sanitizeContent'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../ChatroomContext'
import {
  Actions,
  AttachmentButton,
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
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const setOrUpdateChatRoom = useChatStore((state) => state.setOrUpdateChatRoom)
  const openDialog = useStore((state) => state.openDialog)
  const closeDialog = useStore((state) => state.closeDialog)

  const setEditMsgMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplyMsgMemory = useChatStore((state) => state.setReplyMessageMemory)
  const setCommentMsgMemory = useChatStore((state) => state.setCommentMessageMemory)
  const setMsgDraftMemory = useChatStore((state) => state.setMessageDraftMemory)

  const { request: sendMsg, loading: isSendingMsg } = useApi(sendMessage, null, false)
  const { request: sendComment, loading: isSendingComment } = useApi(
    sendCommentMessage,
    null,
    false
  )
  const { request: updateMsg, loading: isUpdatingMsg } = useApi(updateMessage, null, false)
  const loading = isSendingMsg || isUpdatingMsg || isSendingComment

  const submitRef = useRef<(() => void) | null>(null)

  const { editor, text, html, isEmojiOnly, setIsEmojiOnly } = useTiptapEditor({
    onSubmit: () => submitRef.current?.(),
    workspaceId,
    channelId,
    isToolbarOpen
  })

  const chatChannels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => chatChannels.get(channelId) ?? null,
    [chatChannels, channelId]
  )

  const { replyMessageMemory, editMessageMemory, commentMessageMemory, messageDraftMemory } =
    channelSettings || {}

  const contextType = useMemo((): 'reply' | 'edit' | 'comment' | null => {
    if (replyMessageMemory) return 'reply'
    if (editMessageMemory) return 'edit'
    if (commentMessageMemory) return 'comment'
    return null
  }, [replyMessageMemory, editMessageMemory, commentMessageMemory])

  // Load persisted draft from IndexedDB on mount or channel change
  useEffect(() => {
    if (!editor || !workspaceId || !channelId) return

    // Don't load draft if we're editing/replying/commenting
    if (editMessageMemory || replyMessageMemory || commentMessageMemory) return

    getComposerState(workspaceId, channelId).then((draft: ComposerState | null) => {
      if (draft?.html) {
        editor.chain().setContent(draft.html).focus('end').run()
      }
      // Restore toolbar state
      if (draft?.isToolbarOpen !== undefined) setIsToolbarOpen(draft.isToolbarOpen)

      if (isOnlyEmoji(draft?.text ?? '')) setIsEmojiOnly(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, workspaceId, channelId, editMessageMemory, replyMessageMemory, commentMessageMemory])

  // set the editor content if it is a reply message
  useEffect(() => {
    if (!editor || !editMessageMemory || editMessageMemory.channel_id !== channelId) return

    const content = editMessageMemory.html || editMessageMemory.content
    if (!content) return
    if (!isMobile) editor.chain().setContent(content).focus('start').run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editMessageMemory, channelId])

  // Intentionally NOT gated on `loading`: each send carries its own client
  // UUID and pending row, so rapid-fire is independent (Slack/Linear/Discord).
  const isSubmittable = useCallback(() => {
    if (!editor || !user) return false
    const html = editor.getHTML()
    const text = editor.getText()
    return !!html && !!text && html.replace(/<[^>]*>/g, '').trim() !== '' && text.trim() !== ''
  }, [editor, user])

  // Content preparation. Always returns the same `chunks` shape — an
  // object with `htmlChunks`/`textChunks` arrays — so callers don't
  // need defensive type assertions. The empty path is unreachable in
  // practice (validateSubmission rejects first), but keeping the
  // shape consistent removes a latent crash if validation is ever
  // weakened.
  const prepareContent = useCallback(() => {
    const html = editor?.getHTML()
    const text = editor?.getText()
    if (!html || !text) {
      return {
        sanitizedHtml: '',
        sanitizedText: '',
        chunks: { htmlChunks: [] as string[], textChunks: [] as string[] }
      }
    }

    const { sanitizedHtml, sanitizedText } = sanitizeMessageContent(html, text)

    if (!sanitizedHtml || !sanitizedText) {
      throw new Error('Invalid content detected')
    }

    return {
      sanitizedHtml,
      sanitizedText,
      chunks: chunkHtmlContent(sanitizedHtml, 3000)
    }
  }, [editor])

  const handleEditMessage = useCallback(
    async (content: string, html: string, messageId: string) => {
      await updateMsg(content, html, messageId)
      return true
    },
    [updateMsg]
  )

  const handleCommentMessage = useCallback(
    async (content: string, html: string) => {
      if (!commentMessageMemory || !user) return false

      await sendComment(content, channelId, user.id, html, {
        content: commentMessageMemory.content,
        html: commentMessageMemory.html
      })
      return true
    },
    [commentMessageMemory, channelId, user, sendComment]
  )

  // Delegates the optimistic + send + status-flip pipeline to
  // `useSendMessage` via ChatroomContext; Virtuoso's `data` store owns
  // optimistic row state.
  const handleRegularMessage = useCallback(
    async (content: string, html: string, replyToMessageId: string | null) => {
      if (!user) return false
      await contextSend({
        content,
        html,
        reply_to_message_id: replyToMessageId
      })
      return true
    },
    [user, contextSend]
  )

  // Message routing
  const sendSingleMessage = useCallback(
    async (content: string, html: string) => {
      const messageId = editMessageMemory?.id || replyMessageMemory?.id || null

      if (editMessageMemory) {
        return handleEditMessage(content, html, messageId!)
      }

      if (commentMessageMemory) {
        return handleCommentMessage(content, html)
      }

      return handleRegularMessage(content, html, messageId)
    },
    [
      editMessageMemory,
      replyMessageMemory,
      commentMessageMemory,
      handleEditMessage,
      handleCommentMessage,
      handleRegularMessage
    ]
  )

  // Chunked messages stay non-optimistic for now (deliberate, see Task 8 plan).
  const sendChunkedMessages = useCallback(
    async (htmlChunks: string[], textChunks: string[]) => {
      if (!user) return

      const messageId = editMessageMemory?.id || replyMessageMemory?.id || null

      for (const [index, htmlChunk] of htmlChunks.entries()) {
        const textChunk = textChunks[index]
        const { sanitizedHtmlChunk, sanitizedTextChunk } = sanitizeChunk(htmlChunk, textChunk)

        if (editMessageMemory) {
          await updateMsg(sanitizedTextChunk, sanitizedHtmlChunk, messageId!)
        } else if (commentMessageMemory) {
          await sendComment(sanitizedTextChunk, channelId, user.id, sanitizedHtmlChunk, {
            content: commentMessageMemory.content,
            html: commentMessageMemory.html
          })
        } else {
          await sendMsg({
            content: sanitizedTextChunk,
            channel_id: channelId,
            user_id: user.id,
            html: sanitizedHtmlChunk,
            reply_to_message_id: messageId
          })
        }
      }
    },
    [
      editMessageMemory,
      replyMessageMemory,
      commentMessageMemory,
      channelId,
      user,
      updateMsg,
      sendComment,
      sendMsg
    ]
  )

  // Cleanup function
  const cleanupAfterSubmit = useCallback(() => {
    // Clear memory states
    if (replyMessageMemory) setReplyMsgMemory(channelId, null)
    if (editMessageMemory) setEditMsgMemory(channelId, null)
    if (commentMessageMemory) setCommentMsgMemory(channelId, null)
    setMsgDraftMemory(channelId, {
      text: null,
      html: null
    })

    // Clear IndexedDB draft
    if (workspaceId && channelId) {
      clearComposerState(workspaceId, channelId)
    }

    // Clear editor content. Only refocus if the editor was already the
    // active element — otherwise we'd force-open the iOS keyboard right
    // after the user taps SendButton, causing a visible bounce. Enter-key
    // submits keep the editor focused, so they refocus normally.
    const wasFocused = !!editor && editor.view.dom === document.activeElement
    if (wasFocused) {
      editor?.chain().clearContent(true).focus('start').run()
    } else {
      editor?.chain().clearContent(true).run()
    }
  }, [
    editor,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    channelId,
    workspaceId,
    setReplyMsgMemory,
    setEditMsgMemory,
    setCommentMsgMemory,
    setMsgDraftMemory
  ])

  const openSignInModalHandler = useCallback(() => {
    // append search query to the URL, for when they back to the page they will be redirected to the channel
    const url = new URL(window.location.href)
    url.searchParams.set('open_heading_chat', channelId)
    window.history.pushState({}, '', url.href)

    openDialog(<SignInForm showHeader onClose={closeDialog} />, { size: 'sm', dismissible: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDialog, closeDialog])

  // Optimistic submit: snapshot content → (for optimistic paths) clear
  // editor synchronously → fire send. The visible Enter→empty latency
  // came from clearing AFTER the await; Slack/Linear/Discord all clear
  // before the round-trip.
  //
  // Cleanup timing branches on whether the send path has an optimistic
  // row + Retry affordance:
  //   - Regular sends: cleanup BEFORE await. The optimistic row in the
  //     message list carries the text; `MessageFailedRow` provides
  //     Retry/Delete on failure → no data loss.
  //   - Edit, comment, chunked: cleanup AFTER a successful await.
  //     These paths don't write an optimistic row, so clearing before
  //     a failed send would silently lose the user's text.
  const submitMessage = useCallback(
    async (e?: any) => {
      e?.preventDefault()

      if (!user) {
        openSignInModalHandler()
        return
      }

      if (!isSubmittable()) return

      let prepared
      try {
        prepared = prepareContent()
      } catch (error: unknown) {
        toast.Error(error instanceof Error ? error.message : 'Invalid content')
        return
      }
      const { sanitizedHtml, sanitizedText, chunks } = prepared
      const { htmlChunks, textChunks } = chunks

      const isOptimisticPath =
        htmlChunks.length === 0 && !editMessageMemory && !commentMessageMemory

      if (isOptimisticPath) cleanupAfterSubmit()

      try {
        if (htmlChunks.length === 0) {
          await sendSingleMessage(sanitizedText, sanitizedHtml)
        } else {
          await sendChunkedMessages(htmlChunks, textChunks)
        }
      } catch (error: unknown) {
        toast.Error(error instanceof Error ? error.message : 'Failed to send')
        return
      }

      if (!isOptimisticPath) cleanupAfterSubmit()

      showNotificationPrompt()
    },
    [
      user,
      openSignInModalHandler,
      isSubmittable,
      prepareContent,
      cleanupAfterSubmit,
      sendSingleMessage,
      sendChunkedMessages,
      editMessageMemory,
      commentMessageMemory
    ]
  )

  // Update the ref whenever submitMessage changes
  useEffect(() => {
    submitRef.current = () => submitMessage()
  }, [submitMessage])

  useEffect(() => {
    const setAttributes = () => {
      const firstChild = editorRef.current?.firstChild as HTMLElement | null
      if (firstChild) {
        firstChild.setAttribute('inputmode', 'text')
        firstChild.setAttribute('enterkeyhint', 'send')
      }
    }
    setAttributes()
  }, [editor, editorRef])

  const toggleToolbar = useCallback(() => {
    setIsToolbarOpen(!isToolbarOpen)
    editor?.commands.focus()
  }, [setIsToolbarOpen, isToolbarOpen, editor])

  // Persist toolbar state when it changes independently
  useEffect(() => {
    if (!workspaceId || !channelId || !editor) return

    const text = editor.getText() || ''
    const html = editor.getHTML() || ''

    setComposerStateDebounced(workspaceId, channelId, { text, html, isToolbarOpen })
  }, [isToolbarOpen, workspaceId, channelId, editor])

  useEffect(() => {
    if (!editor) return
    setOrUpdateChatRoom('editorInstance', editor)
    if (editorRef.current) setOrUpdateChatRoom('editorRef', editorRef.current)
    // Clear the refs on unmount so consumers don't dereference a
    // destroyed Tiptap editor (Tiptap auto-destroys on unmount via
    // useEditor). `undefined` matches the chatRoom store's initial
    // shape — all consumers use truthy checks so behavior is identical
    // to `null`, but keeping the type consistent avoids future drift.
    return () => {
      setOrUpdateChatRoom('editorInstance', undefined)
      setOrUpdateChatRoom('editorRef', undefined)
    }
  }, [editor, setOrUpdateChatRoom])

  const contextValue = useMemo(
    () => ({
      sendMsg,
      sendComment,
      updateMsg,
      isSendingMsg,
      isSendingComment,
      isUpdatingMsg,
      loading,
      editor,
      text,
      html,
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      messageDraftMemory: messageDraftMemory ?? null,
      setEditMsgMemory,
      setReplyMsgMemory,
      setCommentMsgMemory,
      contextType,
      isToolbarOpen,
      toggleToolbar,
      submitMessage,
      editorRef,
      isEmojiOnly
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sendMsg,
      sendComment,
      updateMsg,
      loading,
      editor,
      text,
      html,
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      messageDraftMemory,
      contextType,
      isToolbarOpen,
      toggleToolbar,
      submitMessage,
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

// Editor Content
MessageComposer.EditorContent = EditorContent

// Toolbar
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

// Context
MessageComposer.Context = Context
MessageComposer.ReplyContext = ReplyContext
MessageComposer.EditContext = EditContext
MessageComposer.CommentContext = CommentContext

// Actions
MessageComposer.Actions = Actions
MessageComposer.EmojiButton = EmojiButton
MessageComposer.MentionButton = MentionButton
MessageComposer.SendButton = SendButton
MessageComposer.ToggleToolbarButton = ToggleToolbarButton
MessageComposer.AttachmentButton = AttachmentButton

// Input
MessageComposer.Input = Input

// Mobile
MessageComposer.MobileWrapper = MobileWrapper

// Layouts
MessageComposer.MobileLayout = MobileLayout
MessageComposer.DesktopLayout = DesktopLayout
MessageComposer.Editor = Editor
