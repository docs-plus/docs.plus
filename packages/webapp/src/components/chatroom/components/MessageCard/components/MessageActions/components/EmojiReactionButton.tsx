import { useAuthStore, useChatStore } from '@stores'
import { MdOutlineEmojiEmotions } from 'react-icons/md'
import { useMessageCardContext } from '../../../MessageCardContext'
import { useCallback, useRef } from 'react'
import { calculateEmojiPickerPosition } from '../../../helpers'
import Button from '@components/ui/Button'

type Props = {
  className?: string
}

export const EmojiReactionButton = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const ref = useRef<HTMLButtonElement>(null)
  const { openEmojiPicker } = useChatStore()
  const profile = useAuthStore((state) => state.profile)

  const openEmojiPickerHandler = useCallback(() => {
    if (!message) return
    const coordinates = ref.current?.getBoundingClientRect()
    if (!coordinates) return

    const pickerOpenPosition = calculateEmojiPickerPosition(coordinates)
    openEmojiPicker(
      {
        top: pickerOpenPosition?.top || 0,
        left: pickerOpenPosition?.left || 0
      },
      'react2Message',
      message
    )
  }, [openEmojiPicker, message])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      shape="square"
      className={`join-item tooltip tooltip-left ${className || ''}`}
      data-tip="Add Reaction"
      disabled={!profile}
      onClick={openEmojiPickerHandler}
      startIcon={<MdOutlineEmojiEmotions size={20} className="text-base-content/70" />}
    />
  )
}
