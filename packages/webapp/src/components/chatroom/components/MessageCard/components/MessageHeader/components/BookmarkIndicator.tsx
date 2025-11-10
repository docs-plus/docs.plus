import { MdOutlineBookmark } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'
import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

export const BookmarkIndicator = ({ className }: Props) => {
  const { message } = useMessageCardContext()

  if (!message.is_bookmarked || !message.bookmark_id) return null

  return (
    <div
      className={twMerge(
        'flex items-center gap-1 pt-1 pb-4 text-xs font-medium text-blue-600',
        className
      )}>
      <MdOutlineBookmark size={16} />
      <span>Saved for later</span>
    </div>
  )
}
