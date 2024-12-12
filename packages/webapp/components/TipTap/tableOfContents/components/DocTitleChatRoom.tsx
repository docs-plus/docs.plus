import { ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import useOpenChatContainer from '../hooks/useOpenChatContainer'
import { useModal } from '@components/ui/ModalLeftToRight'
import { MdOutlineArrowDropDown } from 'react-icons/md'
import useUnreadMessageEffect from '../hooks/useUnreadMessageEffect'

export const DocTitleChatRoomDesktop = ({ className }: { className?: string }) => {
  const { metadata: docMetadata, workspaceId } = useStore((state) => state.settings)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const unreadMessage = useUnreadMessageEffect(workspaceId || '')
  const openChatContainerHandler = useOpenChatContainer()

  return (
    <div className={`${className} border-b pb-1`}>
      <div className="group flex cursor-pointer items-center justify-between rounded-md p-1 px-2 pr-3 hover:bg-gray-300 hover:bg-opacity-50">
        <span className="text-lg font-bold">{docMetadata?.title}</span>
        <span
          className="btn_chat tooltip tooltip-top relative ml-auto"
          onClick={() => openChatContainerHandler({ id: workspaceId })}
          data-tip="Chat Room">
          {unreadMessage > 0 && (
            <div className="badge badge-accent badge-sm absolute -right-[12px] -top-[6px] z-[1] scale-90 border p-1 shadow">
              {unreadMessage}
            </div>
          )}
          <ChatLeft
            className={`btnChat ml-1 ${headingId === workspaceId && 'fill-docsy !opacity-100'} cursor-pointer transition-all hover:fill-indigo-900 group-hover:fill-docsy`}
            size={16}
          />
        </span>
      </div>
    </div>
  )
}

export const DocTitleChatRoomMobile = ({ className }: { className?: string }) => {
  const { metadata: docMetadata, workspaceId } = useStore((state) => state.settings)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const unreadMessage = useUnreadMessageEffect(workspaceId || '')
  const openChatContainerHandler = useOpenChatContainer()

  const { close: closeModal } = useModal()

  return (
    <div className={`${className} border-b`}>
      <div className="group relative flex items-center justify-between">
        <span className="text-lg font-bold">{docMetadata?.title}</span>
        <span
          className="btn_openChatBox flex items-center justify-end overflow-hidden bg-neutral text-neutral-content"
          onClick={() => {
            openChatContainerHandler({ id: workspaceId })
            closeModal()
          }}
          data-unread-count={unreadMessage > 0 ? unreadMessage : ''}>
          <ChatLeft
            className={`chatLeft fill-neutral-content ${headingId === workspaceId && '!fill-accent'}`}
            size={14}
          />
          <MdOutlineArrowDropDown size={20} className="arrowDown" />
        </span>
      </div>
    </div>
  )
}
