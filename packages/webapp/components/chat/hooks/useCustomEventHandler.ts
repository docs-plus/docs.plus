import { useEffect, MutableRefObject, Dispatch, SetStateAction } from 'react'
import { useChatStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'

export const useCustomEventHandler = (
  channelUsersPresence: Map<string, any>,
  setChannelUsersPresence: Dispatch<SetStateAction<Map<string, any>>>
) => {
  const { channelId } = useChannel()

  const messagesByChannel = useChatStore((state: any) => state.messagesByChannel)
  const messages = messagesByChannel.get(channelId)

  useEffect(() => {
    // listen to custom event update:channel:usersPresence
    const handleUpdateChannelUsersPresence = (e: any) => {
      const { newUser } = e.detail
      // check if the user is already in the channelUsersPresence
      if (channelUsersPresence.has(newUser.id)) return
      setChannelUsersPresence((prevChannelUsersPresence) =>
        new Map(prevChannelUsersPresence).set(newUser.id, newUser)
      )
    }
    document.addEventListener('update:channel:usersPresence', handleUpdateChannelUsersPresence)
    return () => {
      document.removeEventListener('update:channel:usersPresence', handleUpdateChannelUsersPresence)
    }
  }, [channelUsersPresence])
}
