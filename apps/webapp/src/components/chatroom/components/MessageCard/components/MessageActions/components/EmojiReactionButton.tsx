import { openMessageReaction } from '@components/chatroom/utils/messageReaction'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { useCallback, useRef } from 'react'

import { calculateEmojiPickerPosition } from '../../../helpers'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

export const EmojiReactionButton = ({ className }: Props) => {
  const { message } = useMessageCardContext()
  const ref = useRef<HTMLButtonElement>(null)
  const profile = useAuthStore((state) => state.profile)

  const openEmojiPickerHandler = useCallback(() => {
    if (!message) return
    const coordinates = ref.current?.getBoundingClientRect()
    if (!coordinates) return

    const pickerOpenPosition = calculateEmojiPickerPosition(coordinates)
    openMessageReaction(message, {
      top: pickerOpenPosition?.top || 0,
      left: pickerOpenPosition?.left || 0
    })
  }, [message])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      shape="square"
      className={`join-item ${className || ''}`}
      disabled={!profile}
      onClick={openEmojiPickerHandler}
      startIcon={<Icons.emoji size={18} className="text-base-content/70" />}
      tooltip="Add Reaction"
      tooltipPlacement="left"
    />
  )
}
