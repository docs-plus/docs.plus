import CopyButton from '@components/ui/CopyButton'
import { useChatStore } from '@stores'
import { useMemo } from 'react'
import { LuLink } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  successMessage?: string
  errorMessage?: string
}

export const ShareButton = ({
  className,
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
      size="xs"
      variant="ghost"
      icon={LuLink}
      className={twMerge('hover:bg-base-300', className)}
      tooltip="Copy link"
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  )
}
