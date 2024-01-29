import Breadcrumb from './Breadcrumb'
import { useStore, useChatStore } from '@stores'

import { Close as CloseIcon } from '@icons'

const CloseButton = ({ onClick }: any) => (
  <button onClick={onClick}>
    <CloseIcon className="feather feather-x cursor-pointer hover:text-indigo-400 rounded-full w-4 h-4 ml-2" />
  </button>
)

const Toolbar = () => {
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)

  const handelCloseChatRoom = () => {
    destroyChatRoom()
  }

  return (
    <div className="w-full bg-white p-2 pt-3 flex relative z-50 border-b border-gray-200 pb-1">
      <div>
        <Breadcrumb />
      </div>
      <div className="ml-auto">
        <CloseButton onClick={handelCloseChatRoom} />
      </div>
    </div>
  )
}

export default Toolbar
