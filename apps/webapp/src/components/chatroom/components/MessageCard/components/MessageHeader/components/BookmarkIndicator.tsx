import { isMessageBookmarked } from '@components/chatroom/utils/messagePresentation'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'

import { useMessageCardContext } from '../../../MessageCardContext'

type Props = {
  className?: string
}

export const BookmarkIndicator = ({ className }: Props) => {
  const { message } = useMessageCardContext()

  if (!isMessageBookmarked(message)) return null

  return (
    <div
      className={twMerge(
        'text-base-content/70 flex items-center gap-1 pt-1 pb-4 text-xs font-medium',
        className
      )}>
      <Icons.bookmark size={16} />
      <span>Bookmarked</span>
    </div>
  )
}
