import { useComposerEmojiPanelStore } from '@components/chatroom/components/MessageComposer/stores/composerEmojiPanelStore'
import { useChatStore, useSheetStore, useStore } from '@stores'
import type { TMsgRow } from '@types'

import type { EmojiPickerPosition } from '../../../stores/chat/emojiPickerStore'

function handoffComposerEmojiForReactionSheet(): void {
  const emoji = useComposerEmojiPanelStore.getState()
  if (!emoji.isOpen) return
  emoji.close({ consumeHistory: false })
  if ((window.history.state as { composerEmojiPanel?: true } | null)?.composerEmojiPanel) {
    window.history.replaceState({ historyDismiss: true }, '')
  }
}

export function openMessageReaction(message: TMsgRow, position: EmojiPickerPosition): void {
  const isMobile = useStore.getState().settings.editor.isMobile
  if (isMobile) handoffComposerEmojiForReactionSheet()
  useChatStore.getState().openEmojiPicker(position, 'reactToMessage', message)
  if (isMobile && useSheetStore.getState().activeSheet !== 'messageReaction') {
    useSheetStore.getState().openSheet('messageReaction')
  }
}

export function closeMessageReaction(): void {
  useChatStore.getState().closeEmojiPicker()
  if (useSheetStore.getState().activeSheet === 'messageReaction') {
    useSheetStore.getState().closeSheet()
  }
}

// Generic closeSheet / openSheet only write the sheet store. Close the
// picker when the host leaves this sheet so those paths stay picker-safe.
useSheetStore.subscribe(
  (state) => state.activeSheet,
  (activeSheet, previousSheet) => {
    if (previousSheet === 'messageReaction' && activeSheet !== 'messageReaction') {
      useChatStore.getState().closeEmojiPicker()
    }
  }
)
