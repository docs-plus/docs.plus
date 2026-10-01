import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { isMessageBookmarked } from '@components/chatroom/utils/messagePresentation'
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

  const isBookmarked = isMessageBookmarked(message)
  const label = isBookmarked ? 'Remove bookmark' : 'Bookmark'

  const icon = bookmarkLoading ? (
    <span className="loading loading-spinner loading-xs" aria-hidden />
  ) : isBookmarked ? (
    <Icons.bookmarkMinus size={18} className="text-info" />
  ) : (
    <Icons.bookmarkPlus size={18} className="text-base-content/70" />
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
      tooltip={label}
      aria-label={label}
      tooltipPlacement="left"
    />
  )
}
