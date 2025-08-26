import { toast } from 'react-hot-toast'
import { MdLink } from 'react-icons/md'
import { copyToClipboard } from '@utils/index'
import { useChatStore } from '@stores'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  successMessage?: string
  errorMessage?: string
  dataTip?: string
}

export const ShareButton = ({
  className,
  dataTip = 'Copy URL',
  successMessage = 'URL copied to clipboard',
  errorMessage = 'Failed to copy URL'
}: Props) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  const getChatRoomUrl = () => {
    if (!chatRoom?.headingId) return ''
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('chatroom', chatRoom.headingId)
    return newUrl.toString()
  }

  const handleCopyUrl = () => {
    const url = getChatRoomUrl()
    if (!url) return

    copyToClipboard(url)
      .then(() => {
        toast.success(successMessage)
      })
      .catch((err) => toast.error(errorMessage))
  }
  return (
    <button
      className={twMerge('btn btn-square btn-ghost btn-sm', className)}
      onClick={handleCopyUrl}
      data-tip={dataTip}>
      <MdLink size={20} className="rotate-45" />
    </button>
  )
}
