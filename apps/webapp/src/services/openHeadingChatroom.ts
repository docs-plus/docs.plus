import { dismissComposerEmojiAndMentionOverlays } from '@components/chatroom/components/MessageComposer/helpers/dismissComposerOverlays'
import { useAuthStore, useChatStore, useStore } from '@stores'
import type { CommentAnchorV1, Profile } from '@types'
import { retryWithBackoff } from '@utils/retryWithBackoff'
import { scrollToHeading } from '@utils/scrollToHeading'

/** Release pad edit mode; the blur is what dismisses the iOS soft keyboard. */
export function releasePadEditMode(): void {
  const { settings, setWorkspaceEditorSetting } = useStore.getState()
  const editor = settings.editor.instance
  if (!editor) return
  setWorkspaceEditorSetting('isEditable', false)
  editor.setEditable(false)
  editor.view.dom.blur()
}

/**
 * The history route replaces the pad shell, so the pane cannot mount there. Without
 * this the room would stay populated with no surface rendering it.
 */
export function destroyChatRoomForHistory(): void {
  const { chatRoom, destroyChatRoom } = useChatStore.getState()
  if (chatRoom.headingId) destroyChatRoom()
}

/** Sheet-open variant: only acts when the keyboard is up, avoiding a redundant blur. */
export function exitDocEditModeForSheet(): void {
  if (!useStore.getState().isKeyboardOpen) return
  releasePadEditMode()
}

/**
 * Anchor a still-draft doc when its chatroom opens. Chat rows key on the
 * documentId (=workspaceId), which rotates on reload until the draft persists —
 * flipping isDraft fires the server first-edit anchor with the URL slug. Guarded
 * like useHandleDraftOnFocus: a set on a pre-sync (empty) ymetadata map is lost to
 * Yjs last-writer-wins; the isDraft check no-ops on an already-persisted doc.
 */
function anchorDraftForChatroom(): void {
  const { hocuspocusProvider, editor } = useStore.getState().settings
  if (!hocuspocusProvider || editor.providerSyncing) return
  const meta = hocuspocusProvider.configuration.document.getMap('metadata')
  if (meta.get('isDraft')) meta.set('isDraft', false)
}

const FOCUS_RETRY = { maxAttempts: 6, initialDelayMs: 600, maxDelayMs: 1000 }

/**
 * A closed pane unmounts its subtree, so a live `editorInstance` already means the
 * composer is mounted. No separate surface-open check is needed.
 */
function focusChatEditor(): boolean {
  const { editorInstance } = useChatStore.getState().chatRoom
  if (!editorInstance) return false

  editorInstance.commands.focus()
  return true
}

export function focusChatComposerWithRetry(): void {
  retryWithBackoff(focusChatEditor, FOCUS_RETRY)
}

export function insertChatComposerContentWithRetry(insertContent: string): void {
  retryWithBackoff(
    () => {
      const { editorInstance } = useChatStore.getState().chatRoom
      if (!editorInstance) return false

      editorInstance.chain().focus().insertContent(insertContent).run()
      return true
    },
    {
      ...FOCUS_RETRY,
      onRetry: (attempt, error) => {
        console.info(`Attempt ${attempt} failed: ${error.message}. Retrying...`)
      }
    }
  )
}

type ScheduleOpenHeadingChatroomParams = {
  headingId: string
  workspaceId: string | undefined
  user: Profile | null
  fetchMsgsFromId?: string
  onPaneOpen?: () => void
}

function scheduleOpenHeadingChatroomPane({
  headingId,
  workspaceId,
  user,
  fetchMsgsFromId,
  onPaneOpen
}: ScheduleOpenHeadingChatroomParams): void {
  setTimeout(() => {
    if (workspaceId) {
      const chat = useChatStore.getState()
      chat.setChatRoom(headingId, workspaceId, [], user, fetchMsgsFromId)
      chat.openChatRoom()
      // Only seed the mode on a fresh open; switching headings must not yank a
      // reader who is deliberately holding `half`.
      if (chat.chatRoom.paneMode === 'closed') chat.setPaneMode('expanded')
    }
    onPaneOpen?.()
  }, 200)
}

export type OpenHeadingChatroomParams = {
  headingId: string
  intent: 'comment' | 'browse'
  anchor?: CommentAnchorV1
  scroll2Heading?: boolean
  fetchMsgsFromId?: string
  focusEditor?: boolean
  insertContent?: string | null
}

export function openHeadingChatroom({
  headingId,
  intent,
  anchor,
  scroll2Heading = false,
  fetchMsgsFromId,
  focusEditor = false,
  insertContent = null
}: OpenHeadingChatroomParams): void {
  const { workspaceId } = useStore.getState().settings
  const chatStore = useChatStore.getState()
  const { headingId: openedHeadingId, open: chatOpen } = chatStore.chatRoom
  const user = useAuthStore.getState().profile

  // Persist a draft the moment its chat opens (before the comment-intent early
  // return below), so chat keyed on this documentId survives a reload.
  anchorDraftForChatroom()

  chatStore.switchChatRoom(headingId)

  const sheetBase = { headingId, workspaceId, user }

  if (intent === 'comment') {
    if (!anchor) return
    dismissComposerEmojiAndMentionOverlays()
    chatStore.setCommentMessageMemory(headingId, {
      anchor,
      channel_id: headingId,
      workspace_id: workspaceId,
      user
    })
    exitDocEditModeForSheet()

    if (headingId === openedHeadingId && chatOpen) {
      focusChatComposerWithRetry()
      return
    }

    scheduleOpenHeadingChatroomPane({ ...sheetBase, onPaneOpen: focusChatComposerWithRetry })
    return
  }

  scheduleOpenHeadingChatroomPane({
    ...sheetBase,
    fetchMsgsFromId,
    onPaneOpen: scroll2Heading ? () => scrollToHeading(headingId) : undefined
  })
  exitDocEditModeForSheet()
  if (insertContent) insertChatComposerContentWithRetry(insertContent)
  if (focusEditor) focusChatComposerWithRetry()
}

export function openCommentComposer(anchor: CommentAnchorV1): void {
  openHeadingChatroom({ headingId: anchor.heading_id, intent: 'comment', anchor })
}

type OpenHeadingChatBrowseParams = {
  headingId: string
  scroll2Heading?: boolean
  fetchMsgsFromId?: string
  focusEditor?: boolean
  insertContent?: string | null
}

export function openHeadingChatBrowse({
  headingId,
  scroll2Heading = false,
  fetchMsgsFromId,
  focusEditor = false,
  insertContent = null
}: OpenHeadingChatBrowseParams): void {
  openHeadingChatroom({
    headingId,
    intent: 'browse',
    scroll2Heading,
    fetchMsgsFromId,
    focusEditor,
    insertContent
  })
}
