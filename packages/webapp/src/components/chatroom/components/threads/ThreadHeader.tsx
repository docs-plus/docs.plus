import { IoCloseOutline } from 'react-icons/io5'
import { useChatStore } from '@stores'

export const ThreadHeader = () => {
  const clearThread = useChatStore((state: any) => state.clearThread)

  const handelCloseThread = () => {
    // Close the thread
    clearThread()
  }
  return (
    <div className="flex w-full flex-row items-center justify-start bg-base-100 px-4 py-3">
      <h5 className="m-0 font-semibold">Thread</h5>
      <div className="ml-auto">
        <button className="btn btn-circle  btn-sm" onClick={handelCloseThread}>
          <IoCloseOutline className="size-6" />
        </button>
      </div>
    </div>
  )
}
