import { Icons } from '@icons'
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
        'text-primary flex items-center gap-1 pt-1 pb-4 text-xs font-medium',
        className
      )}>
      <Icons.bookmark size={16} />
      <span>Saved for later</span>
    </div>
  )
}
