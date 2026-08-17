import { useChatStore } from '@stores'
import type { Editor } from '@tiptap/core'

import type { EmojiPickerEventType } from '../../../../../stores/chat/emojiPickerStore'
import { useComposerEmojiPanelStore } from '../stores/composerEmojiPanelStore'
import { useComposerLinkDialogStore } from '../stores/composerLinkDialogStore'
import { stopComposerVoiceRecording } from './composerVoiceRecording'
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
  stopComposerVoiceRecording()
  useComposerEmojiPanelStore.getState().close()
  useChatStore.getState().closeEmojiPicker()
}

export function dismissComposerOverlaysBeforeMention(): void {
  stopComposerVoiceRecording()
  dismissComposerEmojiOverlays()
  useComposerLinkDialogStore.getState().close()
}

export function dismissComposerEmojiAndMentionOverlays(editor?: Editor | null): void {
  dismissComposerEmojiOverlays()
  dismissComposerMentionSuggestion(editor ?? useChatStore.getState().chatRoom.editorInstance)
}
