import Icon from '@components/TipTap/toolbar/Icon'
import { useChatStore, useSheetStore, useStore } from '@stores'
import { Editor } from '@tiptap/react'
import { useCallback } from 'react'

import { calculateEmojiPickerPosition } from '../../../../MessageCard/helpers'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

const getCaretPosition = (editor: Editor) => {
  if (!editor) return null

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

export const EmojiButton = ({ className, size = 20, ...props }: Props) => {
  const { editor } = useMessageComposer()
  const { toggleEmojiPicker } = useChatStore()
  const { switchSheet } = useSheetStore()
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  const openEmojiPickerHandler = useCallback(() => {
    if (!editor) return

    if (isMobile) {
      // Switch to the emoji picker sheet, preserving chatroom reference
      // so BottomSheet can restore the chatroom when the picker closes.
      switchSheet('emojiPicker', {
        chatRoomState: { headingId: headingId ?? '' }
      })
    } else {
      const caretPosition = getCaretPosition(editor)
      const pickerOpenPosition = calculateEmojiPickerPosition(caretPosition as DOMRect)
      toggleEmojiPicker(
        {
          top: pickerOpenPosition?.top || 0,
          left: pickerOpenPosition?.left || 0
        },
        'inserEmojiToEditor'
      )
    }
  }, [editor, isMobile, switchSheet, headingId, toggleEmojiPicker])

  return (
    <Button
      className={className}
      onPress={openEmojiPickerHandler}
      tooltip="Emoji"
      tooltipPosition="tooltip-top"
      aria-label="Open emoji picker"
      {...props}>
      <Icon type="MdOutlineEmojiEmotions" size={size} />
    </Button>
  )
}
