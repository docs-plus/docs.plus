import {
  readFormattingToolbarExpanded,
  writeFormattingToolbarExpanded
} from '@components/chatroom/components/MessageComposer/helpers/composerToolbarSession'
import { composerSendGate } from '@components/chatroom/utils/composerSendGate'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { EditorContent } from '@tiptap/react'
import { twMerge } from '@utils/twMerge'
import { nudgeVirtualKeyboardOpenFromVisualViewport } from '@utils/virtualKeyboardMetrics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useChatroomContext } from '../../ChatroomContext'
import { Actions, EmojiButton } from './components/Actions'
import { ComposerEmojiPanel } from './components/ComposerEmojiPanel'
import { Context } from './components/Context'
import { Input } from './components/Input'
import { ComposerDesktopLayout, ComposerLayout, ComposerMobileLayout } from './components/layouts'
import { Toolbar } from './components/Toolbar'
import {
  type ComposerAttachmentActions,
  ComposerAttachmentActionsContext
} from './context/ComposerAttachmentActionsContext'
import { MessageComposerContext } from './context/MessageComposerContext'
import { isComposerInsertEmojiPickerOpen } from './helpers/dismissComposerOverlays'
import { startComposerActivity, stopComposerActivity } from './helpers/handleTypingIndicator'
import { useComposerAttachmentLifecycle } from './hooks/useComposerAttachmentLifecycle'
import { useComposerAttachments } from './hooks/useComposerAttachments'
import { useComposerDraft } from './hooks/useComposerDraft'
import { useComposerModeEdge } from './hooks/useComposerModeEdge'
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
  const focusRequest = useChatStore((state) => state.chatRoom.composerFocusRequest)
  const isEmojiPickerOpen = useChatStore((state) =>
    isComposerInsertEmojiPickerOpen(state.emojiPicker)
  )
  const isEmojiPanelOpen = useComposerEmojiPanelStore((state) => state.isOpen)
  const choosingEmoji = isMobile ? isEmojiPanelOpen : isEmojiPickerOpen

  const setEditMsgMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplyMsgMemory = useChatStore((state) => state.setReplyMessageMemory)
  const setCommentMsgMemory = useChatStore((state) => state.setCommentMessageMemory)

  const submitRef = useRef<(() => void) | null>(null)

  const {
    editor,
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
  )

  const { replyMessageMemory, editMessageMemory, commentMessageMemory } = channelSettings || {}
  const { modeEdge, draftEdge } = useComposerModeEdge(channelSettings)

  const {
    attachments,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAttachments,
    releaseSentAttachments,
    discardModeAttachments,
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
    discardModeAttachments,
    loadExistingAttachments,
    cancelEditAttachments,
    draftHydrated,
    editMessageMemory,
    modeEdge,
    isMobile
  })

  useComposerDraft({
    editor,
    workspaceId,
    channelId,
    editMessageMemory,
    draftEdge,
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
    releaseSentAttachments,
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
      // Landing back ON our own entry (not off it) means some other surface's back()
      // consumed an entry pushed on top of ours. One example is useHistoryDismiss
      // closing an unrelated sheet. That is not a user gesture aimed at this panel,
      // so ignore it.
      if ((window.history.state as { composerEmojiPanel?: true } | null)?.composerEmojiPanel) return
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

  // Reaction pickers never send: the selectors above read the composer emoji UI only.
  useEffect(() => {
    if (!choosingEmoji) return
    startComposerActivity('choosingEmoji')
    return () => stopComposerActivity('choosingEmoji')
  }, [choosingEmoji])

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
    return () => setOrUpdateChatRoom('editorInstance', undefined)
  }, [editor, setOrUpdateChatRoom])

  // The feed load has no time limit, so the composer takes a pending focus
  // request when it mounts. If the user moved focus while the feed loaded,
  // the composer does not take it.
  useEffect(() => {
    if (!editor || focusRequest?.headingId !== channelId) return
    setOrUpdateChatRoom('composerFocusRequest', undefined)
    const active = document.activeElement
    if (!active || active === document.body || active === focusRequest.focusOrigin) {
      editor.commands.focus()
    }
  }, [editor, channelId, focusRequest, setOrUpdateChatRoom])

  // Reactive boolean derived from the debounced `text` from useTiptapEditor.
  // Keeps the context value identity stable across keystrokes that don't
  // transition empty <-> non-empty, killing the typing-cadence rerender cascade
  // through the composer subtree.
  const canSend = composerSendGate({
    text,
    readyAttachmentCount,
    isUploading,
    hasUploadErrors
  })

  const attachmentActions = useMemo<ComposerAttachmentActions>(
    () => ({
      addFiles,
      removeAttachment,
      retryAttachment,
      toggleAttachmentSpoiler
    }),
    [addFiles, removeAttachment, retryAttachment, toggleAttachmentSpoiler]
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
MessageComposer.Context = Context
MessageComposer.Actions = Actions
MessageComposer.EmojiButton = EmojiButton
MessageComposer.Input = Input
MessageComposer.ComposerDesktopLayout = ComposerDesktopLayout
MessageComposer.ComposerMobileLayout = ComposerMobileLayout
MessageComposer.ComposerLayout = ComposerLayout
MessageComposer.ComposerEmojiPanel = ComposerEmojiPanel
