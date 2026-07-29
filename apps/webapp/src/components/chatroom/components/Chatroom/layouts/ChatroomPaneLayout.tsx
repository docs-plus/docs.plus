import { NotificationToggle } from '@components/chatroom/components/ChatroomToolbar/components/NotificationToggle'
import { ShareButton } from '@components/chatroom/components/ChatroomToolbar/components/ShareButton'
import { useChatPaneMode } from '@components/chatroom/hooks/useChatPaneMode'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
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
  // The stored mode, not the rendered one: while the emoji panel promotes the pane to
  // `expanded` the promotion overrides any write, so a grabber driven by the derived
  // value labels itself "Collapse chat" and then moves nothing. Hidden instead.
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
          <ShareButton size="sm" />
          <NotificationToggle size="sm" />
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={destroyChatRoom}
            className="text-base-content/60 hover:text-base-content hover:bg-base-300 focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Close chat">
            <Icons.close size={16} />
          </Button>
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
