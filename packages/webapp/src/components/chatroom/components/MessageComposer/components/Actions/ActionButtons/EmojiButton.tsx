import { Icons } from '@icons'
import { useChatStore, useSheetStore, useStore } from '@stores'
import { Editor } from '@tiptap/react'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { calculateEmojiPickerPosition } from '../../../../MessageCard/helpers'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
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

export const EmojiButton = ({ className, size = 18, ...props }: Props) => {
  const { editor } = useMessageComposer()
  const { toggleEmojiPicker } = useChatStore()
  const { switchSheet } = useSheetStore()
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  const openEmojiPickerHandler = useCallback(() => {
    if (!editor) return

    if (isMobile) {
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
        'insertEmojiToEditor'
      )
    }
  }, [editor, isMobile, switchSheet, headingId, toggleEmojiPicker])

  return (
    <Button
      className={twMerge(
        'size-9 min-h-0 min-w-9 shrink-0 rounded-lg border-0 p-0 sm:size-8 sm:min-h-0 sm:min-w-8',
        className
      )}
      onPress={openEmojiPickerHandler}
      tooltip="Emoji"
      tooltipPosition="top"
      aria-label="Open emoji picker"
      {...props}>
      <Icons.emoji size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
    </Button>
  )
}
