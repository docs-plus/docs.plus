import CloseButton from '@components/ui/CloseButton'
import { useChatStore } from '@stores'

export const ThreadHeader = () => {
  const clearThread = useChatStore((state: any) => state.clearThread)

  const handelCloseThread = () => {
    clearThread()
  }

  return (
    <div className="bg-base-100 flex w-full flex-row items-center justify-start px-4 py-3">
      <h5 className="text-base-content m-0 font-semibold">Thread</h5>
      <div className="ml-auto">
        <CloseButton onClick={handelCloseThread} aria-label="Close thread" />
      </div>
    </div>
  )
}
