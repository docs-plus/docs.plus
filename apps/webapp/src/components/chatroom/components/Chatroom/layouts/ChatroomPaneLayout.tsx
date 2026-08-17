import { NotificationToggle } from '@components/chatroom/components/ChatroomToolbar/components/NotificationToggle'
import { ShareButton } from '@components/chatroom/components/ChatroomToolbar/components/ShareButton'
import CloseButton from '@components/ui/CloseButton'
import { useChatStore } from '@stores'

import BreadcrumbMobile from '../../BreadcrumbMobile'

type Props = {
  children: React.ReactNode
}

const ChatPaneHeader = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)

  return (
    <div className="bg-base-100 border-base-300 flex w-full shrink-0 items-center gap-2 border-b px-3 pb-2">
      <BreadcrumbMobile />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="bg-base-200 rounded-field flex items-center">
          <ShareButton size="sm" iconSize={20} />
          <NotificationToggle size="sm" iconSize={20} />
          <CloseButton onClick={destroyChatRoom} size="sm" iconSize={20} aria-label="Close chat" />
        </div>
      </div>
    </div>
  )
}

export const ChatroomPaneLayout = ({ children }: Props) => (
  <>
    <ChatPaneHeader />
    {children}
  </>
)
