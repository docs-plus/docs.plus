import { useAuthStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'

export default function JoinDirectChannel() {
  const { channelId } = useChannel()

  const user = useAuthStore((state) => state.profile)

  if (!user || !channelId) return null

  return (
    <div className="flex w-full flex-col items-center justify-center p-2">
      <div className="btn btn-block">
        It&apos;s a Direct channel, One-on-one private conversation between two users.
      </div>
    </div>
  )
}
