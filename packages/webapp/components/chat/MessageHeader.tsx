import { useChatStore } from '@stores'
import { Avatar } from '@components/ui/Avatar'
import { useChannel } from './context/ChannelProvider'
import { useMemo } from 'react'
import { TChannelSettings } from '@types'

export const MessageHeader = () => {
  const { channelId } = useChannel()

  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channel = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  if (!channel) return null
  return (
    <div className="flex w-full flex-row items-center justify-start border-b bg-base-200 p-4">
      <div className="size-10">
        <Avatar
          className="m-0 rounded-full ring-2 ring-base-300 ring-offset-2"
          id={channelId}
          collection="shapes"
        />
      </div>

      <div className="ml-3 flex flex-col">
        <h6 className="m-0 font-semibold">{channel.name}</h6>
        <span className="text-xs text-base-content">{channel.member_count} subscribers</span>
      </div>
    </div>
  )
}
