import { useAuthStore, useChatStore } from '@stores'
import { MdOutlineEmojiEmotions } from 'react-icons/md'
import { useMessageCardContext } from '../../../MessageCardContext'
import { twMerge } from 'tailwind-merge'
import { useCallback, useRef } from 'react'
import { calculateEmojiPickerPosition } from '../../../helpers'

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
    <button
      ref={ref}
      className={twMerge(
        'btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left',
        className
      )}
      data-tip="Add Reaction"
      disabled={!profile}
      onClick={openEmojiPickerHandler}>
      <MdOutlineEmojiEmotions size={20} className="text-gray-600" />
    </button>
  )
}
