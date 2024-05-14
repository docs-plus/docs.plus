import React, { useCallback } from 'react'
import { twx, cn } from '@utils/index'
import { MdOutlineAddReaction } from 'react-icons/md'
import { useAuthStore, useStore, useChatStore } from '@stores'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((prop) =>
  cn(
    'btn btn-ghost w-8 h-8 btn-xs p-1 mr-2',
    prop.$active && 'btn-active',
    prop.$size && `w-${prop.$size} h-${prop.$size}`
  )
)

export default function MessageReaction({ message }: any) {
  const user = useAuthStore((state: any) => state.profile)
  const member = useChatStore((state) => state.channelMembers.get(message.channel_id))

  // Allow users who are members of the channel to react to the message.

  const openEmojiPicker = useCallback(
    (clickEvent: any) => {
      const event = new CustomEvent('toggelEmojiPicker', {
        detail: { clickEvent: clickEvent, message, type: 'react2Message' }
      })
      document.dispatchEvent(event)
    },
    [message]
  )

  if (user && !member?.get(user?.id)) return null

  return (
    <div
      className={`dropdown dropdown-end dropdown-bottom absolute bottom-1 ${
        message?.user_details?.id === user?.id ? 'dropdown-left -left-5' : 'dropdown-right -right-7'
      } hidden group-hover/msgcard:block`}>
      <IconButton onClick={openEmojiPicker}>
        <MdOutlineAddReaction size={24} />
      </IconButton>
    </div>
  )
}
