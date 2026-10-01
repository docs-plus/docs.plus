import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMediaOnlyFeedMode } from '@components/chatroom/utils/channelFeedProjection'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'

import { chatToolbarIconButtonClassName } from './ShareButton'

type Props = {
  className?: string
}

export function MediaFilterToggle({ className }: Props) {
  const { feedMode, setFeedMode } = useChatroomContext()
  const mediaOnly = isMediaOnlyFeedMode(feedMode)

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      className={twMerge(
        chatToolbarIconButtonClassName,
        // Literal is-active values: `.is-active` is only styled under the toolbar selectors.
        mediaOnly && 'text-primary bg-primary/10 hover:text-primary hover:bg-primary/10',
        className
      )}
      aria-pressed={mediaOnly}
      aria-label={mediaOnly ? 'Show all messages' : 'Show messages with attachments only'}
      title={mediaOnly ? 'Show all messages' : 'Media only'}
      data-testid="chat-media-filter"
      onClick={() => setFeedMode(mediaOnly ? 'all' : 'media-only')}>
      <Icons.image size={16} aria-hidden />
    </Button>
  )
}
