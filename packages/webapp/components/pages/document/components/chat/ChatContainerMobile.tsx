import { useChatStore } from '@stores'
import ToolbarMobile from '@components/chat/components/ToolbarMobile'
import { ChannelProvider } from '@components/chat/context/ChannelProvider'
import { ChatRoom } from '@components/chat/ChatRoom'
import { ModalBottomToTop } from '@components/ui/ModalBottomToTop'
import { useEffect, useRef } from 'react'

const initSettings = {
  displayChannelBar: false,
  pickEmoji: true,
  textEditor: {
    toolbar: false,
    emojiPicker: false,
    attachmentButton: false
  },
  contextMenue: {
    replyInThread: true,
    forward: false,
    pin: false
  }
}

const ChatContainerMobile = () => {
  const chatRoom = useChatStore((state) => state.chatRoom)
  const modalRef = useRef(null)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)

  useEffect(() => {
    if (!modalRef.current) return

    if (chatRoom?.headingId) {
      ;(modalRef.current as any).check()
    } else {
      ;(modalRef.current as any).uncheck()
    }
  }, [chatRoom?.headingId, modalRef.current])

  const modalStateChange = (state: boolean) => {
    if (!state) destroyChatRoom()
  }

  if (!chatRoom?.headingId) return null

  return (
    <ModalBottomToTop
      showBackdrop={false}
      ref={modalRef}
      onModalStateChange={modalStateChange}
      modalId="chatBottomPannel"
      contentClassName="h-[60%] overflow-hidden"
      defaultHeight={560}>
      <div
        style={{ height: 'calc(100% - 24px)' }}
        className="flex flex-col justify-start overflow-hidden">
        <ToolbarMobile />
        <ChannelProvider initChannelId={chatRoom.headingId} initSettings={initSettings}>
          <ChatRoom className="flex h-auto flex-auto flex-col overflow-auto"></ChatRoom>
        </ChannelProvider>
      </div>
    </ModalBottomToTop>
  )
}

export default ChatContainerMobile
