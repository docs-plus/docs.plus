import { useEffect } from 'react'
import { useStore, useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'

export const useCatchUserPresences = () => {
  const profile = useAuthStore((state) => state.profile)
  const { workspaceId } = useStore((state) => state.settings)
  const setOrUpdateUserPresence = useStore((state) => state.setOrUpdateUserPresence)
  const usersPresence = useStore((state) => state.usersPresence)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const removeUserPresence = useStore((state) => state.removeUserPresence)

  useEffect(() => {
    if (!workspaceId || !profile) return

    const messageSubscription = supabaseClient
      .channel(`workspace_${workspaceId}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // const newState = messageSubscription.presenceState()
        // console.log('sync', newState)
        // newState.forEach((value: any, key: any) => {
        //   channelUsersPresence.set(key, value);
        // }
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // add the user into the channel member state store
        // if the user is not in the channel member state store
        // console.log('join', { key, newPresences })
        if (usersPresence.has(newPresences.at(0)?.id)) return
        const newUser: any = {
          ...newPresences.at(0),
          status: 'ONLINE'
        }
        setOrUpdateUserPresence(newPresences.at(0)?.id, newUser)
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // console.log('leave', key, leftPresences)
        // update user status to offline in the channel member state store
        // if the user is in the channel member state store
        removeUserPresence(leftPresences.at(0)?.id)
        // if (!usersPresence.has(leftPresences.at(0)?.id)) return
        // const newUser: any = {
        //   ...leftPresences.at(0),
        //   status: 'OFFLINE'
        // }
        // setOrUpdateUserPresence(leftPresences.at(0)?.id, newUser)
      })

      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        // console.log("SUBSCRIBED", { status, profile });
        // broadcast user presence
        await messageSubscription.track(profile)
        setWorkspaceSetting('broadcaster', messageSubscription)
      })

    return () => {
      messageSubscription?.unsubscribe()
    }
  }, [profile, workspaceId])
}
