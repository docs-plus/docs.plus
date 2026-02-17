import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}
export const BookmarkButton = ({ className }: Props) => {
  const { bookmarkMessageHandler, bookmarkLoading } = useBookmarkMessageHandler()
  const { message } = useMessageCardContext()
  const profile = useAuthStore((state) => state.profile)

  const icon = bookmarkLoading ? (
    <div className="border-base-content/30 border-t-base-content/70 size-5 animate-spin rounded-full border-2" />
  ) : message.is_bookmarked || message.bookmark_id ? (
    <Icons.bookmarkMinus size={20} className="text-info" />
  ) : (
    <Icons.bookmarkPlus size={20} className="text-base-content/70" />
  )

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      className={`join-item ${className || ''}`}
      disabled={bookmarkLoading || !profile}
      onClick={() => bookmarkMessageHandler(message)}
      startIcon={icon}
      tooltip="Bookmark Message"
      tooltipPlacement="left"
    />
  )
}
