import { useAuthStore } from '@stores'
import { useChatroomContext } from '../../../ChatroomContext'

export default function JoinPrivateChannel() {
  const { channelId } = useChatroomContext()

  const user = useAuthStore((state) => state.profile)

  if (!user || !channelId) return null

  return (
    <div className="flex w-full flex-col items-center justify-center p-2">
      <div className="btn btn-block">
        It&apos;s a private channel, Users can join only by invitation or approval.
      </div>
    </div>
  )
}
