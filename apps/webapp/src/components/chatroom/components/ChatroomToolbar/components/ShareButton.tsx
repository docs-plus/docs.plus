import Button from '@components/ui/Button'
import CopyButton, { CopyButtonSize } from '@components/ui/CopyButton'
import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { Icons } from '@icons'
import { useChatStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'

export const chatToolbarIconButtonClassName =
  'text-base-content/70 hover:text-base-content hover:bg-base-300 focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none'

type Props = {
  className?: string
  size?: CopyButtonSize
  iconSize?: number
  successMessage?: string
  errorMessage?: string
}

export const ShareButton = ({
  className,
  size = 'sm',
  iconSize,
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
  const { copy } = useCopyToClipboard({ successMessage, errorMessage })

  if (!chatRoomUrl) return null

  // Open the OS share sheet where the browser has a share sheet; copy elsewhere.
  if (typeof navigator.share === 'function') {
    const share = () => {
      navigator.share({ url: chatRoomUrl, title: document.title }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        void copy(chatRoomUrl)
      })
    }
    return (
      <Button
        variant="ghost"
        shape="square"
        size={size}
        startIcon={Icons.shareNative}
        iconSize={iconSize}
        tooltip="Share link"
        aria-label="Share link"
        onClick={share}
        className={twMerge(chatToolbarIconButtonClassName, '[&_svg]:stroke-[1.75]', className)}
      />
    )
  }

  return (
    <CopyButton
      text={chatRoomUrl}
      size={size}
      iconSize={iconSize}
      variant="ghost"
      square
      icon={Icons.link}
      className={twMerge(chatToolbarIconButtonClassName, className)}
      tooltip="Copy link"
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  )
}
