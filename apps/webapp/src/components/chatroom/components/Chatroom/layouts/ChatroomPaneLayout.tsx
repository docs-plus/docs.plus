import { NotificationToggle } from '@components/chatroom/components/ChatroomToolbar/components/NotificationToggle'
import { ShareButton } from '@components/chatroom/components/ChatroomToolbar/components/ShareButton'
import { useChatPaneMode } from '@components/chatroom/hooks/useChatPaneMode'
import CloseButton from '@components/ui/CloseButton'
import { useChatStore } from '@stores'

import BreadcrumbMobile from '../../BreadcrumbMobile'

type Props = {
  children: React.ReactNode
}

/**
 * Opting out of scroll-to-expand is what lets the document and the feed scroll
 * independently, and both mobile platforms pair that opt-out with a visible grabber.
 * At 44px this is also the smallest size an assistive technology can reach.
 */
const ChatPaneGrabber = () => {
  // The stored mode, not the rendered one. While the emoji panel promotes the pane to
  // `expanded`, the promotion overrides any write. A grabber driven by the derived value
  // therefore labels itself "Collapse chat" and then moves nothing. Hidden instead.
  const storedMode = useChatStore((state) => state.chatRoom.paneMode)
  const renderedMode = useChatPaneMode()
  const setPaneMode = useChatStore((state) => state.setPaneMode)

  if (renderedMode !== storedMode) return null

  return (
    <button
      type="button"
      onClick={() => setPaneMode(storedMode === 'expanded' ? 'half' : 'expanded')}
      aria-label={storedMode === 'expanded' ? 'Collapse chat' : 'Expand chat'}
      aria-expanded={storedMode === 'expanded'}
      className="focus-visible:ring-primary/30 grid h-11 w-full shrink-0 cursor-pointer place-items-center focus-visible:ring-2 focus-visible:outline-none">
      <span className="bg-base-300 block h-1 w-9 rounded-full" />
    </button>
  )
}

const ChatPaneHeader = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)

  return (
    <div className="bg-base-100 border-base-300 flex w-full shrink-0 items-center gap-2 border-b px-3 pb-2">
      <BreadcrumbMobile />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="bg-base-200 rounded-field flex items-center">
          <ShareButton size="sm" className="min-h-11 min-w-11" />
          <NotificationToggle size="sm" className="min-h-11 min-w-11" />
          <CloseButton
            onClick={destroyChatRoom}
            className="min-h-11 min-w-11"
            aria-label="Close chat"
          />
        </div>
      </div>
    </div>
  )
}

export const ChatroomPaneLayout = ({ children }: Props) => (
  <>
    <ChatPaneGrabber />
    <ChatPaneHeader />
    {children}
  </>
)
