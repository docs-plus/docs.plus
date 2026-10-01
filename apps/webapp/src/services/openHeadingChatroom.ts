import { dismissComposerEmojiAndMentionOverlays } from '@components/chatroom/components/MessageComposer/helpers/dismissComposerOverlays'
import { useAuthStore, useChatStore, useStore } from '@stores'
import type { CommentAnchorV1, Profile } from '@types'
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
 * The chat store outlives the pad shell. When the history route replaces the shell, or
 * a document switch swaps its pad, the open room has no surface left to render it.
 * Close it, or it stays populated and shows the old pad's room.
 */
export function closeOpenChatRoom(): void {
  const { chatRoom, destroyChatRoom } = useChatStore.getState()
  if (chatRoom.headingId) destroyChatRoom()
}

export function focusHeadingChatTrigger(headingId: string | undefined): void {
  if (!headingId) return
  const id = CSS.escape(headingId)
  const candidates = [
    document.querySelector<HTMLElement>(`.toc__chat-trigger[data-heading-id="${id}"]`),
    document.querySelector<HTMLElement>('[data-toc-rail-reopen]'),
    document.querySelector<HTMLElement>(
      '.tableOfContents button:not([disabled]), .tableOfContents a[href]'
    )
  ]
  // A trigger inside a folded subtree exists but cannot take focus; try the next one.
  for (const el of candidates) {
    if (!el) continue
    el.focus({ preventScroll: true })
    if (document.activeElement === el) return
  }
}

/** Sheet-open variant: only acts when the keyboard is up, avoiding a redundant blur. */
export function exitDocEditModeForSheet(): void {
  if (!useStore.getState().isKeyboardOpen) return
  releasePadEditMode()
}

/**
 * Chat rows key on documentId, which rotates until the draft persists. Flip
 * isDraft so the server anchors the URL slug. A pre-sync ymetadata set is lost
 * to last-writer-wins; a persisted doc already has isDraft false.
 */
function anchorDraftForChatroom(): void {
  const { hocuspocusProvider, editor } = useStore.getState().settings
  if (!hocuspocusProvider || editor.providerSyncing) return
  const meta = hocuspocusProvider.configuration.document.getMap('metadata')
  if (meta.get('isDraft')) meta.set('isDraft', false)
}

type OpenHeadingChatroomPaneParams = {
  headingId: string
  workspaceId: string | undefined
  user: Profile | null
  fetchMsgsFromId?: string
}

function openHeadingChatroomPane({
  headingId,
  workspaceId,
  user,
  fetchMsgsFromId
}: OpenHeadingChatroomPaneParams): void {
  if (!workspaceId) return
  const chat = useChatStore.getState()
  chat.setChatRoom(headingId, workspaceId, user, fetchMsgsFromId)
  // Only seed the mode on a fresh open; switching headings must not yank a
  // reader who is deliberately holding `half`.
  if (chat.chatRoom.paneMode === 'closed') chat.setPaneMode('expanded')
}

type OpenHeadingChatroomParams = {
  headingId: string
  intent: 'comment' | 'browse'
  anchor?: CommentAnchorV1
  scroll2Heading?: boolean
  fetchMsgsFromId?: string
  focusEditor?: boolean
}

export function openHeadingChatroom({
  headingId,
  intent,
  anchor,
  scroll2Heading = false,
  fetchMsgsFromId,
  focusEditor = false
}: OpenHeadingChatroomParams): void {
  const { workspaceId } = useStore.getState().settings
  const chatStore = useChatStore.getState()
  const { headingId: openedHeadingId, paneMode: openedMode } = chatStore.chatRoom
  const user = useAuthStore.getState().profile

  // Persist a draft the moment its chat opens (before the comment-intent early
  // return below), so chat keyed on this documentId survives a reload.
  anchorDraftForChatroom()

  chatStore.switchChatRoom(headingId)
  // Every open overwrites the request, so a stale one never focuses a later composer.
  chatStore.setOrUpdateChatRoom(
    'composerFocusRequest',
    intent === 'comment' || focusEditor
      ? { headingId, focusOrigin: document.activeElement }
      : undefined
  )

  const paneOpen = { headingId, workspaceId, user }

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

    if (headingId === openedHeadingId && openedMode !== 'closed') return

    openHeadingChatroomPane(paneOpen)
    return
  }

  openHeadingChatroomPane({ ...paneOpen, fetchMsgsFromId })
  if (scroll2Heading) scrollToHeading(headingId)
  exitDocEditModeForSheet()
}

export function openCommentComposer(anchor: CommentAnchorV1): void {
  openHeadingChatroom({ headingId: anchor.heading_id, intent: 'comment', anchor })
}

export function openHeadingChatBrowse(
  params: Omit<OpenHeadingChatroomParams, 'intent' | 'anchor'>
): void {
  openHeadingChatroom({ ...params, intent: 'browse' })
}
