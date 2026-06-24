import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMediaOnlyFeedMode } from '@components/chatroom/utils/channelFeedProjection'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

export function MediaFilterToggle({ className }: Props) {
  const { feedMode, setFeedMode } = useChatroomContext()
  const mediaOnly = isMediaOnlyFeedMode(feedMode)

  return (
    <button
      type="button"
      className={twMerge(
        'btn btn-ghost btn-sm btn-square',
        mediaOnly && 'text-primary bg-primary/10',
        className
      )}
      aria-pressed={mediaOnly}
      aria-label={mediaOnly ? 'Show all messages' : 'Show messages with attachments only'}
      title={mediaOnly ? 'Show all messages' : 'Media only'}
      data-testid="chat-media-filter"
      onClick={() => setFeedMode(mediaOnly ? 'all' : 'media-only')}>
      <Icons.image size={16} aria-hidden />
    </button>
  )
}
