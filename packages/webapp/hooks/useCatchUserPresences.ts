import { useEffect } from 'react'
import { useStore, useAuthStore } from '@stores'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const useCatchUserPresences = () => {
  const supabaseClient = createClientComponentClient()

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
        // console.log('sync', newState, typeof newState, data)
        // Object.keys(newState).forEach((key) => {
        // channelUsersPresence.set(key, value);
        // console.log('sync', { key, value: newState[key].at(0) })
        // setOrUpdateUserPresence(newState[key].at(0), newState[key].at(0))
        // })
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // add the user into the channel member state store
        // if the user is not in the channel member state store
        // console.log('join', { key, newPresences })
        // const usersPresence = useStore.getState().usersPresence
        // if (usersPresence.has(newPresences.at(0)?.id)) return

        // when a new user joins the channel, I need to send the current users status to the new user

        const usersPresence = useStore.getState().usersPresence

        const payload = Array.from(usersPresence.values())
          .filter((user: any) => user.channelId)
          .map((user: any) => ({ id: user.id, channelId: user.channelId }))

        if (payload.length) {
          messageSubscription.send({
            type: 'broadcast',
            event: 'presenceSync',
            payload
          })
        }

        newPresences.forEach((presence) => {
          const user: any = {
            ...presence,
            status: 'ONLINE'
          }
          setOrUpdateUserPresence(user.id, user)
        })
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const newState = messageSubscription.presenceState()
        // console.log('leave', { key, leftPresences, newState })
        // update user status to offline in the channel member state store
        // if the user is in the channel member state store
        // if (leftPresences.at(0).channelId === 'empty') return
        removeUserPresence(leftPresences.at(0)?.id)
        // if (!usersPresence.has(leftPresences.at(0)?.id)) return
        // const newUser: any = {
        //   ...leftPresences.at(0),
        //   status: 'OFFLINE'
        // }
        // setOrUpdateUserPresence(leftPresences.at(0)?.id, newUser)
      })
      .on('broadcast', { event: 'presenceSync' }, (data) => {
        const usersPresence = useStore.getState().usersPresence
        const payload = data.payload
        if (!payload.length) return

        payload.forEach((user: any) => {
          const newUser: any = {
            ...usersPresence.get(user.id),
            ...user
          }
          setOrUpdateUserPresence(user.id, newUser)
        })
      })
      .on('broadcast', { event: 'presence' }, (data) => {
        // console.log('broadcast ->> presence', { data })
        const payload = data.payload
        // const usersPresence = useStore.getState().usersPresence
        // if (usersPresence.has(payload.id)) return
        setOrUpdateUserPresence(payload.id, payload)
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
