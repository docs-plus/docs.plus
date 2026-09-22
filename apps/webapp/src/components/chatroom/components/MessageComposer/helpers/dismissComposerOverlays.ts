import { closeMessageReaction } from '@components/chatroom/utils/messageReaction'
import { useChatStore } from '@stores'

import type { EmojiPickerEventType } from '../../../../../stores/chat/emojiPickerStore'
import { useComposerEmojiPanelStore } from '../stores/composerEmojiPanelStore'
import { useComposerLinkDialogStore } from '../stores/composerLinkDialogStore'
import { discardComposerVoiceNote } from './composerVoiceRecording'
import { dismissComposerMentionSuggestion } from './mentionTypes'

type ComposerEmojiPicker = { isOpen: boolean; eventType: EmojiPickerEventType | null }

export function isComposerInsertEmojiPickerOpen(picker: ComposerEmojiPicker): boolean {
  return picker.isOpen && picker.eventType === 'insertEmojiToEditor'
}

export function isComposerEmojiOverlayOpen(): boolean {
  return (
    useComposerEmojiPanelStore.getState().isOpen ||
    isComposerInsertEmojiPickerOpen(useChatStore.getState().emojiPicker)
  )
}

/** Close the inline panel and any emoji picker, including the reaction picker. */
export function dismissComposerEmojiOverlays(): void {
  discardComposerVoiceNote()
  useComposerEmojiPanelStore.getState().close()
  closeMessageReaction()
}

export function dismissComposerOverlaysBeforeMention(): void {
  dismissComposerEmojiOverlays()
  useComposerLinkDialogStore.getState().close()
}

/** No voice discard: it would end the recording that is starting. */
export function dismissComposerOverlaysBeforeVoice(): void {
  useComposerEmojiPanelStore.getState().close()
  closeMessageReaction()
  dismissComposerMentionSuggestion(useChatStore.getState().chatRoom.editorInstance)
}

export function dismissComposerEmojiAndMentionOverlays(): void {
  discardComposerVoiceNote()
  dismissComposerOverlaysBeforeVoice()
}
