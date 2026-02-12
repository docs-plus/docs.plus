import { NotificationToggle } from '@components/chatroom/components/ChatroomToolbar/components/NotificationToggle'
import { ShareButton } from '@components/chatroom/components/ChatroomToolbar/components/ShareButton'
import Button from '@components/ui/Button'
import { useChatStore, useSheetStore } from '@stores'
import { LuX } from 'react-icons/lu'

import BreadcrumbMobile from '../../BreadcrumbMobile'

type Props = {
  children: React.ReactNode
}

const ChatRoomHeader = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const { closeSheet } = useSheetStore()

  const handleClose = () => {
    destroyChatRoom()
    closeSheet()
  }

  return (
    <div className="bg-base-100 border-base-300 flex w-full items-center gap-2 border-b px-3 py-2">
      <BreadcrumbMobile />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="bg-base-200 rounded-selector flex items-center">
          <ShareButton size="sm" />
          <NotificationToggle size="sm" />
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={handleClose}
            className="text-base-content/60 hover:text-base-content hover:bg-base-300 focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Close chat">
            <LuX size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export const MobileLayout = ({ children }: Props) => {
  return (
    <>
      <ChatRoomHeader />
      {children}
    </>
  )
}
