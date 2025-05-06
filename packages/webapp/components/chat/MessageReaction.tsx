import React, { useCallback } from 'react'
import { twx, cn } from '@utils/index'
import { MdOutlineAddReaction } from 'react-icons/md'
import { useAuthStore, useChatStore, useStore } from '@stores'

// Define proper types
interface MessageType {
  id: string
  channel_id: string
  user_details?: {
    id: string
  }
  // Add other message properties as needed
}

interface MessageReactionProps {
  message: MessageType
  className?: string
}

interface UserProfile {
  id: string
  // Add other user profile properties as needed
}

// Move button component type and definition outside of the main component
type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  $active?: boolean
  $size?: number
}

const IconButton = twx.button<IconButtonProps>((prop) =>
  cn(
    'btn btn-ghost btn-square w-8 h-8 btn-xs p-1 mr-2',
    prop.$active && 'btn-active',
    prop.$size && `w-${prop.$size} h-${prop.$size}`
  )
)

export default function MessageReaction({ message, className }: MessageReactionProps) {
  const user = useAuthStore((state) => state.profile as UserProfile)
  const member = useChatStore((state) => state.channelMembers.get(message.channel_id))
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  // User can only react if they are a member of the channel
  const canUserReact = user && member?.get(user?.id)

  const openEmojiPicker = useCallback(
    (event: React.MouseEvent) => {
      const customEvent = new CustomEvent('toggelEmojiPicker', {
        detail: {
          clickEvent: event,
          message,
          type: 'react2Message'
        }
      })
      document.dispatchEvent(customEvent)
    },
    [message]
  )

  if (!canUserReact) return null

  const isCurrentUserMessage = message?.user_details?.id === user?.id
  const dropdownPosition = isCurrentUserMessage && isMobile ? 'dropdown-left ' : 'dropdown-right '

  return (
    <div
      className={`dropdown dropdown-end dropdown-bottom ${dropdownPosition} invisible group-hover/msgcard:visible ${className}`}>
      <IconButton onClick={openEmojiPicker}>
        <MdOutlineAddReaction size={24} />
      </IconButton>
    </div>
  )
}
