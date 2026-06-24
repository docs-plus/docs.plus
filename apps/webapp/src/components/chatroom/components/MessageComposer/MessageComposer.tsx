import {
  readFormattingToolbarExpanded,
  writeFormattingToolbarExpanded
} from '@components/chatroom/components/MessageComposer/helpers/composerToolbarSession'
import { composerSendGate } from '@components/chatroom/utils/composerSendGate'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { EditorContent } from '@tiptap/react'
import type { TChannelSettings } from '@types'
import { nudgeVirtualKeyboardOpenFromVisualViewport } from '@utils/virtualKeyboardMetrics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../ChatroomContext'
import {
  Actions,
  AttachButton,
  EmojiButton,
  MentionButton,
  SendButton,
  ToggleToolbarButton
} from './components/Actions'
import { ComposerEmojiPanel } from './components/ComposerEmojiPanel'
import { Context } from './components/Context'
import CommentContext from './components/Context/CommentContext'
import EditContext from './components/Context/EditContext'
import ReplyContext from './components/Context/ReplyContext'
import { Input } from './components/Input'
import { ComposerDesktopLayout, ComposerLayout, ComposerMobileLayout } from './components/layouts'
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
import {
  type ComposerAttachmentActions,
  ComposerAttachmentActionsContext
} from './context/ComposerAttachmentActionsContext'
import { MessageComposerContext } from './context/MessageComposerContext'
import { useComposerAttachmentLifecycle } from './hooks/useComposerAttachmentLifecycle'
import { useComposerAttachments } from './hooks/useComposerAttachments'
import { useComposerDraft } from './hooks/useComposerDraft'
import { useComposerSubmit } from './hooks/useComposerSubmit'
import { useTiptapEditor } from './hooks/useTiptapEditor'
import { useComposerEmojiPanelStore } from './stores/composerEmojiPanelStore'

const MessageComposer = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => {
  const { channelId, send: contextSend, variant } = useChatroomContext()
  const isMobile = variant === 'mobile'
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
    html,
    text,
    isEmojiOnly,
    setIsEmojiOnly,
    cancelPendingEditorDraftCapture,
    setDraftHydrated,
    draftHydrated
  } = useTiptapEditor({
    onSubmit: () => submitRef.current?.(),
    workspaceId,
    channelId,
    submitOnEnter: !isMobile,
    isComposerMobile: isMobile
  })

  // Leaf-selector: subscribe to just this channel's settings row so unrelated
  // workspaceSettings.channels mutations don't rerender the composer.
  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  ) as TChannelSettings | null

  const { replyMessageMemory, editMessageMemory, commentMessageMemory } = channelSettings || {}

  const {
    attachments,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAttachments,
    loadExistingAttachments,
    flushRemovedPersistedStorage,
    cancelEditAttachments,
    hasUploadErrors,
    isUploading,
    readyAttachmentCount,
    getReadyAttachments,
    toggleAttachmentSpoiler
  } = useComposerAttachments({
    workspaceId,
    channelId,
    userId: user?.id
  })

  useComposerAttachmentLifecycle({
    workspaceId,
    channelId,
    userId: user?.id,
    editor,
    editorRef,
    attachments,
    addFiles,
    clearAttachments,
    loadExistingAttachments,
    cancelEditAttachments,
    text,
    html,
    draftHydrated,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    isMobile
  })

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

  const { submitMessage } = useComposerSubmit({
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
    cancelPendingEditorDraftCapture,
    keepKeyboardAfterSubmit: isMobile,
    getReadyAttachments,
    clearAttachments,
    flushRemovedPersistedStorage,
    isUploadingAttachments: isUploading,
    hasUploadErrors
  })

  useEffect(() => {
    submitRef.current = () => {
      void submitMessage()
    }
  }, [submitMessage])

  useEffect(() => {
    if (!isMobile || !editor) return
    const dom = editor.view.dom
    const onFocusIn = () => {
      const { isOpen, close } = useComposerEmojiPanelStore.getState()
      if (isOpen) close()
    }
    const onPopState = () => {
      const { isOpen, close } = useComposerEmojiPanelStore.getState()
      if (!isOpen) return
      close()
      editor.commands.focus()
    }
    dom.addEventListener('focusin', onFocusIn)
    window.addEventListener('popstate', onPopState)
    return () => {
      dom.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('popstate', onPopState)
    }
  }, [editor, isMobile])

  const toggleToolbar = useCallback(() => {
    setShowFormattingToolbar((prev) => {
      const next = !prev
      if (workspaceId && channelId) writeFormattingToolbarExpanded(workspaceId, channelId, next)
      return next
    })
    editor?.commands.focus()
    if (isMobile) {
      nudgeVirtualKeyboardOpenFromVisualViewport()
      requestAnimationFrame(() => nudgeVirtualKeyboardOpenFromVisualViewport())
    }
  }, [workspaceId, channelId, editor, isMobile])

  useEffect(() => {
    if (!editor) return
    setOrUpdateChatRoom('editorInstance', editor)
    if (editorRef.current) setOrUpdateChatRoom('editorRef', editorRef.current)
    return () => {
      setOrUpdateChatRoom('editorInstance', undefined)
      setOrUpdateChatRoom('editorRef', undefined)
    }
  }, [editor, setOrUpdateChatRoom])

  // Reactive boolean derived from the debounced `text` from useTiptapEditor.
  // Keeps the context value identity stable across keystrokes that don't
  // transition empty <-> non-empty, killing the typing-cadence rerender cascade
  // through the composer subtree.
  const canSend = composerSendGate({
    text,
    readyAttachmentCount,
    editMessageMemory,
    isUploading,
    hasUploadErrors
  })

  const attachmentActions = useMemo<ComposerAttachmentActions>(
    () => ({
      addFiles,
      removeAttachment,
      retryAttachment,
      clearAttachments,
      toggleAttachmentSpoiler
    }),
    [addFiles, removeAttachment, retryAttachment, clearAttachments, toggleAttachmentSpoiler]
  )

  const contextValue = useMemo(
    () => ({
      editor,
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      setEditMsgMemory,
      setReplyMsgMemory,
      setCommentMsgMemory,
      showFormattingToolbar,
      toggleToolbar,
      submitMessage,
      canSend,
      isMobile,
      editorRef,
      isEmojiOnly
    }),
    [
      editor,
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      setEditMsgMemory,
      setReplyMsgMemory,
      setCommentMsgMemory,
      showFormattingToolbar,
      toggleToolbar,
      submitMessage,
      canSend,
      isMobile,
      isEmojiOnly
    ]
  )

  return (
    <ComposerAttachmentActionsContext.Provider value={attachmentActions}>
      <MessageComposerContext.Provider value={contextValue}>
        <div className={twMerge('flex flex-col', className)}>{children}</div>
      </MessageComposerContext.Provider>
    </ComposerAttachmentActionsContext.Provider>
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
MessageComposer.AttachButton = AttachButton
MessageComposer.EmojiButton = EmojiButton
MessageComposer.MentionButton = MentionButton
MessageComposer.SendButton = SendButton
MessageComposer.ToggleToolbarButton = ToggleToolbarButton
MessageComposer.Input = Input
MessageComposer.ComposerDesktopLayout = ComposerDesktopLayout
MessageComposer.ComposerMobileLayout = ComposerMobileLayout
MessageComposer.ComposerLayout = ComposerLayout
MessageComposer.ComposerEmojiPanel = ComposerEmojiPanel
