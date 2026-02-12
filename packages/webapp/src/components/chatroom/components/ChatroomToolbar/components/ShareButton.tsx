import CopyButton, { CopyButtonSize } from '@components/ui/CopyButton'
import { useChatStore } from '@stores'
import { useMemo } from 'react'
import { LuLink } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  size?: CopyButtonSize
  successMessage?: string
  errorMessage?: string
}

export const ShareButton = ({
  className,
  size = 'xs',
  successMessage = 'Chatroom URL copied',
  errorMessage = 'Failed to copy URL'
}: Props) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  const chatRoomUrl = useMemo(() => {
    if (!chatRoom?.headingId) return ''
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatroom', chatRoom.headingId)
    return newUrl.toString()
  }, [chatRoom?.headingId])

  if (!chatRoomUrl) return null

  return (
    <CopyButton
      text={chatRoomUrl}
      size={size}
      variant="ghost"
      square
      icon={LuLink}
      className={twMerge(
        'text-base-content/60 hover:text-base-content hover:bg-base-300 focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
      tooltip="Copy link"
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  )
}
