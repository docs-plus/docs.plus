import { Icons } from '@icons'
import { useChatStore, useStore } from '@stores'
import { Editor } from '@tiptap/react'
import { twMerge } from '@utils/twMerge'
import { useCallback } from 'react'

import { calculateEmojiPickerPosition } from '../../../../MessageCard/helpers'
import { discardComposerVoiceNote } from '../../../helpers/composerVoiceRecording'
import { isComposerInsertEmojiPickerOpen } from '../../../helpers/dismissComposerOverlays'
import { dismissComposerMentionSuggestion } from '../../../helpers/mentionTypes'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import { useComposerEmojiPanelStore } from '../../../stores/composerEmojiPanelStore'
import { useComposerLinkDialogStore } from '../../../stores/composerLinkDialogStore'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

function getCaretRect(editor: Editor): DOMRect {
  const { left, top } = editor.view.coordsAtPos(editor.state.selection.from)
  return { left, top, x: left, y: top } as DOMRect
}

export const EmojiButton = ({ size, ...props }: Props) => {
  const { editor, isMobile } = useMessageComposer()
  const glyph = size ?? (isMobile ? 20 : 18)
  const openEmojiPicker = useChatStore((s) => s.openEmojiPicker)
  const closeEmojiPicker = useChatStore((s) => s.closeEmojiPicker)
  const isDesktopComposerPickerOpen = useChatStore((s) =>
    isComposerInsertEmojiPickerOpen(s.emojiPicker)
  )
  const isPanelOpen = useComposerEmojiPanelStore((s) => s.isOpen)
  const isActive = isMobile ? isPanelOpen : isDesktopComposerPickerOpen

  const onPress = useCallback(() => {
    if (!editor) return

    discardComposerVoiceNote()
    dismissComposerMentionSuggestion(editor)

    if (isMobile) {
      const panel = useComposerEmojiPanelStore.getState()
      if (panel.isOpen) {
        panel.close()
        editor.commands.focus()
        return
      }
      useComposerLinkDialogStore.getState().close()
      panel.open(editor)
      if (useStore.getState().isKeyboardOpen) editor.view.dom.blur()
      return
    }

    const { emojiPicker } = useChatStore.getState()
    const insertOpen = isComposerInsertEmojiPickerOpen(emojiPicker)
    if (emojiPicker.isOpen) closeEmojiPicker()
    if (insertOpen) return

    useComposerLinkDialogStore.getState().close()
    const position = calculateEmojiPickerPosition(getCaretRect(editor))
    openEmojiPicker({ top: position?.top || 0, left: position?.left || 0 }, 'insertEmojiToEditor')
  }, [closeEmojiPicker, editor, isMobile, openEmojiPicker])

  let Icon = Icons.emoji
  let ariaLabel = 'Open emoji picker'
  if (isMobile && isPanelOpen) {
    Icon = Icons.keyboard
    ariaLabel = 'Show keyboard'
  }

  return (
    <Button
      onPress={onPress}
      tooltip={ariaLabel}
      tooltipPosition="top"
      isActive={isActive}
      aria-pressed={isActive}
      aria-label={ariaLabel}
      aria-expanded={isActive}
      {...props}>
      <Icon
        size={glyph}
        className={twMerge(
          'pointer-events-none shrink-0 stroke-[1.75]',
          isActive && 'text-primary'
        )}
      />
    </Button>
  )
}
