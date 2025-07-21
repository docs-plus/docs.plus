import { useTiptapEditor } from './hooks/useTiptapEditor'
import { sendMessage, updateMessage, createThreadMessage, sendCommentMessage } from '@api'
import { useApi } from '@hooks/useApi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageComposerContext } from './context/MessageComposerContext'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useChannel } from '../../context/ChannelProvider'
import { TChannelSettings } from '@types'
import { toolbarStorage } from './helpers/toolbarStorage'

import { EditorContent } from '@tiptap/react'
import {
  Toolbar,
  BlockquoteButton,
  CodeButton,
  HyperlinkButton,
  ItalicButton,
  OrderedListButton,
  StrikethroughButton,
  BulletListButton,
  BoldButton,
  CodeBlockButton
} from './components/Toolbar'
import { Context } from './components/Context'
import { sanitizeMessageContent, sanitizeChunk } from '@utils/sanitizeContent'
import { chunkHtmlContent } from '@utils/chunkHtmlContent'
import * as toast from '@components/toast'
import { messageInsert } from '../../hooks/listner/helpers'

import {
  Actions,
  EmojiButton,
  MentionButton,
  SendButton,
  ToggleToolbarButton
} from './components/Actions'

import { Input } from './components/Input'
import { twMerge } from 'tailwind-merge'
import ReplyContext from './components/Context/ReplyContext'
import EditContext from './components/Context/EditContext'
import CommentContext from './components/Context/CommentContext'

const MessageComposer = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => {
  const { channelId } = useChannel()
  const user = useAuthStore((state) => state.profile)
  const setOrUpdateUserPresence = useChatStore((state: any) => state.setOrUpdateUserPresence)
  const usersPresence = useStore((state: any) => state.usersPresence)
  const startThreadMessage = useChatStore((state) => state.startThreadMessage)
  const channels = useChatStore((state) => state.channels)
  const { workspaceId } = useChatStore((state) => state.workspaceSettings)
  const editorRef = useRef<HTMLDivElement | null>(null)

  const [toggleToolbar, setToggleToolbar] = useState(() => toolbarStorage.get())

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
  const { request: sendThreadMsg, loading: isSendingThreadMsg } = useApi(
    createThreadMessage,
    null,
    false
  )
  const loading = useMemo(() => {
    return isSendingMsg || isUpdatingMsg || isSendingComment || isSendingThreadMsg
  }, [isSendingMsg, isUpdatingMsg, isSendingComment, isSendingThreadMsg])

  // Simple ref for the submit callback
  const submitRef = useRef<(() => void) | null>(null)

  const { editor, text, html } = useTiptapEditor({
    loading,
    onSubmit: () => submitRef.current?.()
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

  // User presence management, keep users data update insted open a new portal (supabase realtime)
  const updateUserPresence = useCallback(() => {
    const users = [replyMessageMemory?.user_details, editMessageMemory?.user_details]
      .filter(Boolean)
      .filter((user) => user && !usersPresence.has(user.id))

    users.forEach((user) => user && setOrUpdateUserPresence(user.id, user))
  }, [replyMessageMemory, editMessageMemory, usersPresence, setOrUpdateUserPresence])

  // set the editor content if it is a reply message
  useEffect(() => {
    if (!editor || !editMessageMemory || editMessageMemory.channel_id !== channelId) return

    const content = editMessageMemory.html || editMessageMemory.content
    if (!content) return

    editor.chain().setContent(content).focus('start').run()
  }, [editor, editMessageMemory, channelId])

  // Validation helpers
  const validateSubmission = useCallback(() => {
    if (!editor || !user) return { isValid: false, error: 'Editor or user not available' }

    const isContentEmpty =
      !html || !text || html.replace(/<[^>]*>/g, '').trim() === '' || text.trim() === ''
    if (isContentEmpty) return { isValid: false, error: 'Content is empty' }

    if (loading) return { isValid: false, error: 'Already loading' }

    return { isValid: true }
  }, [editor, user, html, text, loading])

  // Content preparation
  const prepareContent = useCallback(() => {
    const { sanitizedHtml, sanitizedText } = sanitizeMessageContent(html, text)

    if (!sanitizedHtml || !sanitizedText) {
      throw new Error('Invalid content detected')
    }

    return {
      sanitizedHtml,
      sanitizedText,
      chunks: chunkHtmlContent(sanitizedHtml, 3000)
    }
  }, [html, text])

  // Message type handlers
  const handleThreadMessage = useCallback(
    async (content: string, html: string) => {
      if (!startThreadMessage?.id || !user || !workspaceId) return false

      const threadId = startThreadMessage.id
      if (!channels.has(threadId)) return false

      const fakemessage = createFakeMessage(content, html, user, threadId)
      messageInsert(fakemessage)

      await createThreadMessage({
        p_content: content,
        p_html: html,
        p_thread_id: threadId,
        p_workspace_id: workspaceId
      })
      return true
    },
    [startThreadMessage, channels, user, workspaceId, messageInsert, createThreadMessage]
  )

  const handleEditMessage = useCallback(
    async (content: string, html: string, messageId: string) => {
      await updateMessage(content, html, messageId)
      return true
    },
    [updateMessage]
  )

  const handleCommentMessage = useCallback(
    async (content: string, html: string) => {
      if (!commentMessageMemory || !user) return false

      await sendCommentMessage(content, channelId, user.id, html, {
        content: commentMessageMemory.content,
        html: commentMessageMemory.html
      })
      return true
    },
    [commentMessageMemory, channelId, user, sendCommentMessage]
  )

  const handleRegularMessage = useCallback(
    async (content: string, html: string, messageId: string | null) => {
      if (!user) return false

      const fakemessage = createFakeMessage(content, html, user, channelId)
      messageInsert(fakemessage)

      const { error } = await sendMessage(content, channelId, user.id, html, messageId)
      if (error) console.error('[handleRegularMessage]', error)
      return true
    },
    [user, channelId, messageInsert, sendMessage]
  )

  // Message routing
  const sendSingleMessage = useCallback(
    async (content: string, html: string) => {
      const messageId = editMessageMemory?.id || replyMessageMemory?.id || null

      if (startThreadMessage?.id === channelId) {
        return handleThreadMessage(content, html)
      }

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
      startThreadMessage,
      channelId,
      commentMessageMemory,
      handleThreadMessage,
      handleEditMessage,
      handleCommentMessage,
      handleRegularMessage
    ]
  )

  // Chunked message handling
  const sendChunkedMessages = useCallback(
    async (htmlChunks: string[], textChunks: string[]) => {
      if (!user) return

      const messageId = editMessageMemory?.id || replyMessageMemory?.id || null

      for (const [index, htmlChunk] of htmlChunks.entries()) {
        const textChunk = textChunks[index]
        const { sanitizedHtmlChunk, sanitizedTextChunk } = sanitizeChunk(htmlChunk, textChunk)

        if (editMessageMemory) {
          await updateMessage(sanitizedTextChunk, sanitizedHtmlChunk, messageId!)
        } else if (commentMessageMemory) {
          await sendCommentMessage(sanitizedTextChunk, channelId, user.id, sanitizedHtmlChunk, {
            content: commentMessageMemory.content,
            html: commentMessageMemory.html
          })
        } else {
          await sendMessage(sanitizedTextChunk, channelId, user.id, sanitizedHtmlChunk, messageId)
        }
      }
    },
    [
      editMessageMemory,
      replyMessageMemory,
      commentMessageMemory,
      channelId,
      user,
      updateMessage,
      sendCommentMessage,
      sendMessage
    ]
  )

  // Cleanup function
  const cleanupAfterSubmit = useCallback(() => {
    editor?.commands.clearContent(true)
    editor?.view.focus()
    editor?.commands.focus()

    // Clear memory states
    if (replyMessageMemory) setReplyMsgMemory(channelId, null)
    if (editMessageMemory) setEditMsgMemory(channelId, null)
    if (commentMessageMemory) setCommentMsgMemory(channelId, null)
    setMsgDraftMemory(channelId, {
      text: null,
      html: null
    })
    document.dispatchEvent(new CustomEvent('messages:container:scroll:down'))
  }, [
    editor,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    channelId,
    setReplyMsgMemory,
    setEditMsgMemory,
    setCommentMsgMemory,
    setMsgDraftMemory
  ])

  // Helper to create fake message
  const createFakeMessage = useCallback(
    (content: string, html: string, user: any, channelId: string) => {
      const currentDate = new Date().toISOString()
      return {
        new: {
          id: 'fake_id',
          content,
          html,
          user_details: user,
          channel_id: channelId,
          user_id: user.id,
          created_at: currentDate,
          updated_at: currentDate
        }
      }
    },
    []
  )

  // Main submit function - now clean and focused
  const submitMessage = useCallback(
    async (e?: any) => {
      e?.preventDefault()
      editor?.view.focus()

      // 1. Validate
      const validation = validateSubmission()
      if (!validation.isValid) return

      try {
        // 2. Prepare content
        const { sanitizedHtml, sanitizedText, chunks } = prepareContent()
        const { htmlChunks, textChunks } = chunks

        // 3. Update user presence
        updateUserPresence()

        // 4. Send message(s)
        if (htmlChunks.length === 0) {
          await sendSingleMessage(sanitizedText, sanitizedHtml)
        } else {
          await sendChunkedMessages(htmlChunks, textChunks)
        }
      } catch (error: any) {
        toast.Error(error.message)
      } finally {
        // 5. Cleanup
        cleanupAfterSubmit()
      }
    },
    [
      editor,
      validateSubmission,
      prepareContent,
      updateUserPresence,
      sendSingleMessage,
      sendChunkedMessages,
      cleanupAfterSubmit
    ]
  )

  // Update the ref whenever submitMessage changes
  useEffect(() => {
    submitRef.current = () => submitMessage()
  }, [submitMessage])

  useEffect(() => {
    // TODO: this is temporary
    setTimeout(() => {
      document.querySelector('.tiptap.ProseMirror')?.setAttribute('inputmode', 'text')
      document.querySelector('.tiptap.ProseMirror')?.setAttribute('enterkeyhint', 'send')
    }, 1000)
  }, [editor])

  useEffect(() => {
    const setAttributes = () => {
      const firstChild = editorRef.current?.firstChild as HTMLElement | null
      if (firstChild) {
        firstChild.setAttribute('inputmode', 'text')
        firstChild.setAttribute('enterkeyhint', 'send')
      }
    }
    setAttributes()
  }, [editor])

  // Save toolbar toggle state to localStorage
  useEffect(() => {
    toolbarStorage.set(toggleToolbar)
  }, [toggleToolbar])

  // Handle Draft Memory
  useEffect(() => {
    return () => {
      // Save draft before unmounting
      const html = editor?.getHTML()
      const text = editor?.getText()
      if (html && text) {
        setMsgDraftMemory(channelId, {
          text: text,
          html: html
        })
      }
    }
  }, [editor, channelId, setMsgDraftMemory])

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

  useEffect(() => {
    // TODO: this is temporary
    setTimeout(() => {
      document.querySelector('.tiptap.ProseMirror')?.setAttribute('inputmode', 'text')
      document.querySelector('.tiptap.ProseMirror')?.setAttribute('enterkeyhint', 'send')
    }, 1000)
  }, [editor])

  const contextValue = {
    sendMsg,
    sendComment,
    updateMsg,
    sendThreadMsg,
    isSendingMsg,
    isSendingComment,
    isUpdatingMsg,
    isSendingThreadMsg,
    loading,
    editor,
    text,
    html,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    messageDraftMemory,
    setEditMsgMemory,
    setReplyMsgMemory,
    setCommentMsgMemory,
    contextType,
    toggleToolbar,
    setToggleToolbar,
    submitMessage,
    editorRef
  }

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

// Input
MessageComposer.Input = Input
