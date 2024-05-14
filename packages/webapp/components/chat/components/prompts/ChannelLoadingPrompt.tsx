import { LoadingOverlay } from '../chatContainer'

export const ChannelLoadingPrompt = ({ loading }: { loading: boolean }) => {
  return (
    <div className="relative flex h-dvh w-full max-w-full flex-col items-center justify-start bg-base-300">
      <LoadingOverlay loading={loading} />
    </div>
  )
}
