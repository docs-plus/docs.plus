import { twMerge } from 'tailwind-merge'
import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import { Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'
import { useChatStore, useSheetStore, useStore } from '@stores'
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
  const { openSheet, closeSheet } = useSheetStore()
  const { chatRoom } = useChatStore()
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const calculatePickerPosition = (coordinates: any) => {
    const { clientHeight, clientWidth } = document.querySelector('em-emoji-picker') as HTMLElement

    // we need to pick up these dynamic values from the DOM
    const emojiButtonWidth = 24
    const chatEditorHeight = 153

    let newTop, newLeft

    if (coordinates) {
      newTop = coordinates.y || coordinates.top
      newLeft = coordinates.x || coordinates.left

      // Adjust for right and bottom edges
      if (newLeft + clientWidth + emojiButtonWidth > window.innerWidth) {
        newLeft = newLeft - clientWidth
      }
      if (newTop + clientHeight + chatEditorHeight > window.innerHeight) {
        newTop = newTop - clientHeight
      }

      // Adjust for top and left edges
      newTop = Math.max(0, newTop)
      newLeft = Math.max(0, newLeft)

      return {
        top: newTop,
        left: newLeft
      }
    }
  }

  const openEmojiPickerHandler = useCallback(() => {
    if (!editor) return

    const caretPosition = getCaretPosition(editor)
    const pickerOpenPosition = calculatePickerPosition(caretPosition)

    if (isMobile) {
      closeSheet()
      openSheet('emojiPicker', {
        chatRoomState: { ...chatRoom }
      })
    } else {
      toggleEmojiPicker(
        {
          top: pickerOpenPosition?.top || 0,
          left: pickerOpenPosition?.left || 0
        },
        'inserEmojiToEditor'
      )
    }
  }, [editor, chatRoom])

  return (
    <Button
      className={className}
      onPress={openEmojiPickerHandler}
      tooltip="Emoji"
      tooltipPosition="tooltip-top"
      {...props}>
      <Icon type="MdOutlineEmojiEmotions" size={size} />
    </Button>
  )
}
