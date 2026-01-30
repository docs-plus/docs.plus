import { useAuthStore } from '@stores'
import { LuLock } from 'react-icons/lu'

import { useChatroomContext } from '../../../ChatroomContext'

export default function JoinPrivateChannel() {
  const { channelId } = useChatroomContext()
  const user = useAuthStore((state) => state.profile)

  if (!user || !channelId) return null

  return (
    <div className="border-base-300 bg-base-100 flex w-full items-center justify-center gap-2 border-t p-3">
      <div className="bg-base-200 text-base-content/60 flex items-center gap-2 rounded-full px-4 py-2 text-sm">
        <LuLock size={14} className="shrink-0" />
        <span>Private channel - join by invitation only</span>
      </div>
    </div>
  )
}
