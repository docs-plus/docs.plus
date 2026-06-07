import { Icons } from '@icons'
import { useChatStore, useStore } from '@stores'
import { Editor } from '@tiptap/react'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { calculateEmojiPickerPosition } from '../../../../MessageCard/helpers'
import { isComposerInsertEmojiPickerOpen } from '../../../helpers/dismissComposerOverlays'
import { dismissComposerMentionSuggestion } from '../../../helpers/mentionTypes'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import { useComposerEmojiPanelStore } from '../../../stores/composerEmojiPanelStore'
import { useComposerLinkDialogStore } from '../../../stores/composerLinkDialogStore'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

const getCaretPosition = (editor: Editor) => {
  const { selection } = editor.state
  const coords = editor.view.coordsAtPos(selection.from)
  return {
    x: coords.left + window.scrollX,
    y: coords.top + window.scrollY,
    bottom: coords.bottom + window.scrollY,
    right: coords.right + window.scrollX,
    top: coords.top + window.scrollY,
    left: coords.left + window.scrollX
  }
}

export const EmojiButton = ({ className, size = 18, ...props }: Props) => {
  const { editor, isMobile } = useMessageComposer()
  const openEmojiPicker = useChatStore((s) => s.openEmojiPicker)
  const closeEmojiPicker = useChatStore((s) => s.closeEmojiPicker)
  const isDesktopComposerPickerOpen = useChatStore((s) =>
    isComposerInsertEmojiPickerOpen(s.emojiPicker)
  )
  const isPanelOpen = useComposerEmojiPanelStore((s) => s.isOpen)
  const isActive = isMobile ? isPanelOpen : isDesktopComposerPickerOpen

  const onPress = useCallback(() => {
    if (!editor) return

    dismissComposerMentionSuggestion(editor)

    if (isMobile) {
      const panel = useComposerEmojiPanelStore.getState()
      if (panel.isOpen) {
        panel.close()
        // The press itself is a user gesture; iOS treats this focus as
        // gestured and opens the virtual keyboard.
        editor.commands.focus()
        return
      }
      // Order matters: open() snapshots the current keyboard height into
      // the store before blur() resets useStore.keyboardHeight to 0.
      panel.open(editor)
      if (useStore.getState().isKeyboardOpen) editor.view.dom.blur()
      return
    }

    const { emojiPicker } = useChatStore.getState()
    const insertOpen = isComposerInsertEmojiPickerOpen(emojiPicker)
    if (emojiPicker.isOpen) closeEmojiPicker()
    if (insertOpen) return

    useComposerLinkDialogStore.getState().close()
    const caret = getCaretPosition(editor)
    const position = calculateEmojiPickerPosition(caret as DOMRect)
    openEmojiPicker({ top: position?.top || 0, left: position?.left || 0 }, 'insertEmojiToEditor')
  }, [closeEmojiPicker, editor, isMobile, openEmojiPicker])

  const Icon = isMobile && isPanelOpen ? Icons.keyboard : Icons.emoji
  const ariaLabel = isMobile && isPanelOpen ? 'Show keyboard' : 'Open emoji picker'

  return (
    <Button
      className={twMerge(
        'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
        className
      )}
      onPress={onPress}
      tooltip={ariaLabel}
      tooltipPosition="top"
      isActive={isActive}
      aria-pressed={isActive}
      aria-label={ariaLabel}
      aria-expanded={isActive}
      {...props}>
      <Icon
        size={size}
        className={twMerge(
          'pointer-events-none shrink-0 stroke-[1.75]',
          isActive && 'text-primary'
        )}
      />
    </Button>
  )
}
