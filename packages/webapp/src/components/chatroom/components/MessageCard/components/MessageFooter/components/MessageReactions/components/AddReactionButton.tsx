import { useMessageCardContext } from '@components/chatroom/components/MessageCard/MessageCardContext'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import { useChatStore } from '@stores'
import { useCallback, useMemo } from 'react'
import { MdOutlineAddReaction } from 'react-icons/md'

import { calculateEmojiPickerPosition } from '../../../../../helpers'

type Props = {
  className?: string
}
const AddReactionButton = ({ className: _className }: Props) => {
  const { message } = useMessageCardContext()
  const user = useAuthStore((state) => state.profile)
  const member = useChatStore((state) => state.channelMembers.get(message.channel_id))
  const { openEmojiPicker } = useChatStore()
  // User can only react if they are a member of the channel
  const canUserReact = useMemo(() => user && member?.get(user?.id), [user, member])

  const openEmojiPickerHandler = useCallback(
    (event: React.MouseEvent) => {
      const coordinates = (event.target as HTMLElement).getBoundingClientRect()
      const pickerOpenPosition = calculateEmojiPickerPosition(coordinates)
      openEmojiPicker(
        {
          top: pickerOpenPosition?.top || 0,
          left: pickerOpenPosition?.left || 0
        },
        'react2Message',
        message
      )
    },
    [message]
  )

  if (!canUserReact || Object.keys(message.reactions || {}).length === 0) return null

  return (
    <Button
      variant="ghost"
      size="xs"
      className="badge bg-base-300 cursor-pointer border-none !px-2"
      onClick={openEmojiPickerHandler}
      startIcon={<MdOutlineAddReaction size={18} />}
    />
  )
}

export default AddReactionButton
