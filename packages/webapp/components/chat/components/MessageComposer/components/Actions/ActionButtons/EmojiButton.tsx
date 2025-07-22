import { twMerge } from 'tailwind-merge'
import Button from '../../ui/Button'
import Icon from '@components/TipTap/toolbar/Icon'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import { Editor } from '@tiptap/react'
import { useCallback } from 'react'
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  className?: string
  size?: number
}

const getCaretPositionWithScroll = (editor: Editor) => {
  if (!editor) return null

  const { selection } = editor.state
  const coords = editor.view.coordsAtPos(selection.from)

  return {
    x: coords.left + window.scrollX,
    y: coords.top + window.scrollY,
    bottom: coords.bottom + window.scrollY,
    right: coords.right + window.scrollX
  }
}

export const EmojiButton = ({ className, size = 20, ...props }: Props) => {
  const { editor } = useMessageComposer()

  const openEmojiPicker = useCallback(
    (clickEvent: any) => {
      if (!editor) return

      const caretPosition = getCaretPositionWithScroll(editor)

      const event = new CustomEvent('toggelEmojiPicker', {
        detail: {
          clickEvent: clickEvent,
          editor,
          type: 'inserEmojiToEditor',
          coordinates: caretPosition
        }
      })
      document.dispatchEvent(event)
    },
    [editor]
  )

  return (
    <Button
      className={className}
      onPress={openEmojiPicker}
      tooltip="Emoji"
      tooltipPosition="tooltip-top"
      {...props}>
      <Icon type="MdOutlineEmojiEmotions" size={size} />
    </Button>
  )
}
