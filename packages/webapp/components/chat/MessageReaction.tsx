import React, { useCallback } from 'react'
import { twx, cn } from '@utils/twx'
import { MdOutlineAddReaction } from 'react-icons/md'
import { useAuthStore } from '@stores'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((prop) =>
  cn(
    'btn btn-ghost w-8 h-8 btn-xs p-1 mr-2',
    prop.$active && 'btn-active',
    prop.$size && `w-${prop.$size} h-${prop.$size}`
  )
)

export default function MessageReaction({ message }: any) {
  const user = useAuthStore.use.profile()

  const openEmojiPicker = useCallback(
    (clickEvent: any) => {
      const event = new CustomEvent('toggelEmojiPicker', {
        detail: { clickEvent: clickEvent, message, type: 'react2Message' }
      })
      document.dispatchEvent(event)
    },
    [message]
  )

  return (
    <div
      className={`dropdown dropdown-end dropdown-bottom absolute top-[50%] translate-y-[-50%] ${
        message?.user_details?.id === user?.id ? 'dropdown-left -left-4' : 'dropdown-right -right-4'
      } hidden group-hover:block`}>
      <IconButton onClick={openEmojiPicker}>
        <MdOutlineAddReaction size={24} />
      </IconButton>
    </div>
  )
}
