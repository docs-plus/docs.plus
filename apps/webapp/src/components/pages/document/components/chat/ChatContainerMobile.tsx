import Chatroom from '@components/chatroom/Chatroom'
import MsgComposer from '@components/chatroom/components/MessageComposer/MessageComposer'
import { useComposerEmojiPanelStore } from '@components/chatroom/components/MessageComposer/stores/composerEmojiPanelStore'
import { useChatStore, useSheetStore } from '@stores'
import { useEffect } from 'react'

/** Handoff: drop the emoji history entry so the sheet can own `historyDismiss`. */
function closeComposerEmojiForReactionSheet(): void {
  const emoji = useComposerEmojiPanelStore.getState()
  if (!emoji.isOpen) return
  emoji.close({ consumeHistory: false })
  if ((window.history.state as { composerEmojiPanel?: true } | null)?.composerEmojiPanel) {
    window.history.replaceState({ historyDismiss: true }, '')
  }
}

const ChatContainerMobile = () => {
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const isReactionOpen = useChatStore(
    (s) => s.emojiPicker.isOpen && s.emojiPicker.eventType === 'reactToMessage'
  )

  useEffect(() => {
    return () => {
      const paneClosed = useChatStore.getState().chatRoom.paneMode === 'closed'
      useComposerEmojiPanelStore.getState().close({ consumeHistory: !paneClosed })
      useChatStore.getState().closeEmojiPicker()
      if (!paneClosed && useSheetStore.getState().activeSheet === 'messageReaction') {
        useSheetStore.getState().closeSheet()
      }
    }
  }, [headingId])

  useEffect(() => {
    return useSheetStore.subscribe(
      (s) => s.activeSheet,
      (sheet, prev) => {
        if (prev === 'messageReaction' && sheet !== 'messageReaction') {
          useChatStore.getState().closeEmojiPicker()
        }
      }
    )
  }, [])

  useEffect(() => {
    if (isReactionOpen) {
      closeComposerEmojiForReactionSheet()
      if (useSheetStore.getState().activeSheet !== 'messageReaction') {
        useSheetStore.getState().openSheet('messageReaction')
      }
      return
    }
    if (useSheetStore.getState().activeSheet === 'messageReaction') {
      useSheetStore.getState().closeSheet()
    }
  }, [isReactionOpen])

  if (!headingId) return null

  return (
    // True last-in-flow element. This element carries the safe-area inset, so the inset
    // stays reserved beneath whichever child renders last. Chatroom and ComposerEmojiPanel
    // are siblings, and the composer alone can't know which is visually at the bottom.
    // ChatPane reads `data-chat-pane-body` to fold this inset into its height clamp.
    <div
      data-chat-pane-body
      className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)]">
      <Chatroom variant="mobile" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chatroom.MessageFeed showScrollToBottom />
        <Chatroom.ChannelComposer className="w-full" />
      </Chatroom>
      <MsgComposer.ComposerEmojiPanel />
    </div>
  )
}

export default ChatContainerMobile
