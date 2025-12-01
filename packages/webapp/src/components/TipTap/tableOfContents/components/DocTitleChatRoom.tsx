import { ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import useOpenChatContainer from '../hooks/useOpenChatContainer'
import { useModal } from '@components/ui/ModalDrawer'
import useUnreadMessageEffect from '../hooks/useUnreadMessageEffect'
import usePresentUsers from '../hooks/usePresentUsers'
import AvatarStack from '@components/AvatarStack'
import { scrollToTitle } from '../utils'

export const DocTitleChatRoomDesktop = ({ className }: { className?: string }) => {
  const { metadata: docMetadata, workspaceId } = useStore((state) => state.settings)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const unreadMessage = useUnreadMessageEffect(workspaceId || '')
  const presentUsers = usePresentUsers(workspaceId || '')

  return (
    <div className={`${className} relative border-b border-gray-300 pb-1`}>
      <div
        className={`group hover:bg-opacity-50 flex cursor-pointer items-center justify-between rounded-md p-1 px-2 pr-3 hover:bg-gray-300 ${headingId === workspaceId && 'activeTocBorder bg-gray-300'}`}
        onClick={() => {
          scrollToTitle({
            workspaceId,
            title: docMetadata?.title,
            openChatRoom: true
          })
        }}>
        <span className="text-lg font-bold">{docMetadata?.title}</span>
        <span
          className="btn_chat tooltip tooltip-top relative ml-auto"
          onClick={() => {
            scrollToTitle({
              workspaceId,
              title: docMetadata?.title,
              openChatRoom: true
            })
          }}
          data-tip="Chat Room">
          {unreadMessage > 0 && (
            <div className="badge badge-docsy badge-sm bg-docsy border-docsy absolute top-1/2 z-[1] -translate-y-1/2 scale-90 border border-none text-white">
              {unreadMessage > 99 ? '99+' : unreadMessage}
            </div>
          )}
          <ChatLeft
            className={`btnChat ml-1 ${unreadMessage > 0 && 'hidden'} group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900`}
            size={16}
          />
        </span>
        <div className="absolute -right-9">
          {presentUsers.length > 0 && (
            <AvatarStack
              size={8}
              users={presentUsers}
              showStatus={true}
              tooltipPosition="tooltip-left"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export const DocTitleChatRoomMobile = ({ className }: { className?: string }) => {
  const { metadata: docMetadata, workspaceId } = useStore((state) => state.settings)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const unreadMessage = useUnreadMessageEffect(workspaceId || '')
  const openChatContainerHandler = useOpenChatContainer()

  const { close: closeModal } = useModal() || {}

  return (
    <div className={`${className} border-b border-gray-300`}>
      <div className="group relative flex items-center justify-between py-2">
        <span className="text-lg font-bold">{docMetadata?.title}</span>
        <span
          className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
          onClick={() => {
            openChatContainerHandler({ id: workspaceId })
            closeModal?.()
          }}
          data-unread-count={unreadMessage > 0 ? unreadMessage : ''}>
          <ChatLeft
            className={`chatLeft fill-neutral-content ${headingId === workspaceId && '!fill-accent'}`}
            size={14}
          />
          {/* <MdOutlineArrowDropDown size={20} className="arrowDown" /> */}
        </span>
      </div>
    </div>
  )
}
