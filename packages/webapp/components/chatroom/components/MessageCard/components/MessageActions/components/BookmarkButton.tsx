import { useMessageCardContext } from '../../../MessageCardContext'
import { useBookmarkMessageHandler } from '@components/chatroom/components/MessageCard/hooks/useBookmarkMessageHandler'
import { twMerge } from 'tailwind-merge'
import { MdBookmarkRemove, MdOutlineBookmarkAdd } from 'react-icons/md'

type Props = {
  className?: string
}
export const BookmarkButton = ({ className }: Props) => {
  const { bookmarkMessageHandler, bookmarkLoading } = useBookmarkMessageHandler()
  const { message } = useMessageCardContext()

  return (
    <button
      className={twMerge(
        'btn btn-sm btn-square join-item btn-ghost tooltip tooltip-left',
        className
      )}
      data-tip="Bookmark Message"
      disabled={bookmarkLoading}
      onClick={() => bookmarkMessageHandler(message)}>
      {bookmarkLoading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      ) : message.is_bookmarked || message.bookmark_id ? (
        <MdBookmarkRemove size={20} className="text-blue-600" />
      ) : (
        <MdOutlineBookmarkAdd size={20} className="text-gray-600" />
      )}
    </button>
  )
}
