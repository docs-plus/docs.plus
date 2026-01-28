import { useChatStore } from '@stores'
import CloseButton from '@components/ui/CloseButton'

export const ThreadHeader = () => {
  const clearThread = useChatStore((state: any) => state.clearThread)

  const handelCloseThread = () => {
    // Close the thread
    clearThread()
  }
  return (
    <div className="bg-base-100 flex w-full flex-row items-center justify-start px-4 py-3">
      <h5 className="m-0 font-semibold text-slate-800">Thread</h5>
      <div className="ml-auto">
        <CloseButton onClick={handelCloseThread} aria-label="Close thread" />
      </div>
    </div>
  )
}
