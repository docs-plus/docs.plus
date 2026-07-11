import { dismissComposerEmojiAndMentionOverlays } from '@components/chatroom/components/MessageComposer/helpers/dismissComposerOverlays'
import { useAuthStore, useChatStore, useSheetStore, useStore } from '@stores'
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

/** Sheet-open variant: only acts when the keyboard is up, avoiding a redundant blur. */
export function exitDocEditModeForSheet(): void {
  if (!useStore.getState().isKeyboardOpen) return
  releasePadEditMode()
}

const FOCUS_RETRY = { maxAttempts: 6, initialDelayMs: 600, maxDelayMs: 1000 }

function focusChatEditor(requireSheetForMobile: boolean): boolean {
  const { editorInstance } = useChatStore.getState().chatRoom
  if (!editorInstance) return false

  if (requireSheetForMobile) {
    const { isSheetOpen } = useSheetStore.getState()
    const isMobile = useStore.getState().settings.deviceDetect?.isMobile
    if (!isSheetOpen('chatroom') && isMobile) return false
  }

  editorInstance.commands.focus()
  return true
}

export function focusChatComposerWithRetry(): void {
  retryWithBackoff(() => focusChatEditor(true), FOCUS_RETRY)
}

export function focusChatEditorWithRetry(): void {
  retryWithBackoff(() => focusChatEditor(false), FOCUS_RETRY)
}

export function insertChatComposerContentWithRetry(insertContent: string): void {
  retryWithBackoff(
    () => {
      const { editorInstance } = useChatStore.getState().chatRoom
      const { sheetState, isSheetOpen } = useSheetStore.getState()

      if (sheetState === 'open' && editorInstance && isSheetOpen('chatroom')) {
        editorInstance.chain().focus().insertContent(insertContent).run()
        return true
      }
      if (isSheetOpen('chatroom') && editorInstance) {
        useSheetStore.getState().setSheetState('open')
        return false
      }
      return false
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
  onSheetOpen?: () => void
}

function scheduleOpenHeadingChatroomSheet({
  headingId,
  workspaceId,
  user,
  fetchMsgsFromId,
  onSheetOpen
}: ScheduleOpenHeadingChatroomParams): void {
  setTimeout(() => {
    if (workspaceId) {
      const chat = useChatStore.getState()
      chat.setChatRoom(headingId, workspaceId, [], user, fetchMsgsFromId)
      chat.openChatRoom()
      useSheetStore.getState().openSheet('chatroom', { headingId })
    }
    onSheetOpen?.()
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

    scheduleOpenHeadingChatroomSheet({ ...sheetBase, onSheetOpen: focusChatComposerWithRetry })
    return
  }

  scheduleOpenHeadingChatroomSheet({
    ...sheetBase,
    fetchMsgsFromId,
    onSheetOpen: scroll2Heading ? () => scrollToHeading(headingId) : undefined
  })
  exitDocEditModeForSheet()
  if (insertContent) insertChatComposerContentWithRetry(insertContent)
  if (focusEditor) focusChatEditorWithRetry()
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
