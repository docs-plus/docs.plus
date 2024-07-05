import { useChatStore } from '@stores'
import { IoCloseSharp } from 'react-icons/io5'
import BreadcrumbMobile from './BreadcrumbMobile'

const CloseButton = ({ onClick }: any) => (
  <button className="btn btn-circle btn-xs ml-auto" onClick={onClick}>
    <IoCloseSharp size={20} />
  </button>
)

const ToolbarMobile = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)

  const handelCloseChatRoom = () => {
    destroyChatRoom()
  }

  return (
    <div className="shadow-top-only relative z-50 flex w-full items-center rounded-t-2xl bg-white p-2">
      <div className="min-w-0 flex-1">
        <BreadcrumbMobile />
      </div>
      <div className="ml-2 shrink-0">
        <CloseButton onClick={handelCloseChatRoom} />
      </div>
    </div>
  )
}

export default ToolbarMobile
