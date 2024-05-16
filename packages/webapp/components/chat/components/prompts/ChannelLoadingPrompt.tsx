import { LoadingOverlay } from '../chatContainer'

export const ChannelLoadingPrompt = ({ loading }: { loading: boolean }) => {
  return (
    <div className="relative flex size-full max-w-full flex-1 flex-col items-center justify-start bg-base-300">
      <LoadingOverlay loading={loading} />
    </div>
  )
}
