import { useMessageCardContext } from '../../../MessageCardContext'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { MdBookmarkRemove, MdOutlineBookmarkAdd } from 'react-icons/md'
import { useAuthStore } from '@stores'
import Button from '@components/ui/Button'

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
    <MdBookmarkRemove size={20} className="text-info" />
  ) : (
    <MdOutlineBookmarkAdd size={20} className="text-base-content/70" />
  )

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      className={`join-item tooltip tooltip-left ${className || ''}`}
      data-tip="Bookmark Message"
      disabled={bookmarkLoading || !profile}
      onClick={() => bookmarkMessageHandler(message)}
      startIcon={icon}
    />
  )
}
