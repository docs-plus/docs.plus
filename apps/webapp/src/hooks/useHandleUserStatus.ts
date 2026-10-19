import { updateUser } from '@api'
import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import debounce from 'lodash/debounce'
import { useEffect } from 'react'

const HEARTBEAT_INTERVAL = 60_000 // under the 2-minute lease in internal.is_user_online
const HIDE_DELAY = 3_000
// 2 s past HIDE_DELAY: a hidden tab's timers can fire about 1 s late, and the shown tab must write last.
const SHOW_DELAY = 5_000

export const useHandleUserStatus = (enabled = true) => {
  const userId = useAuthStore((state) => state.profile?.id)

  useEffect(() => {
    if (!enabled || !userId) return
    let heartbeat: ReturnType<typeof setInterval> | null = null
    // Hold the JWT so unload can start keepalive in the same turn.
    let accessToken: string | null = null
    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? null
    })

    const writeStatus = async (status: 'ONLINE' | 'OFFLINE') => {
      if (!navigator.onLine) return // the global fetch rejects offline; skip to keep the log quiet
      const { error } = await updateUser(userId, { status })
      if (error) console.warn(`Status write ${status} failed`, error.message)
    }
    const showWrite = debounce(() => void writeStatus('ONLINE'), SHOW_DELAY)
    const hideWrite = debounce(() => void writeStatus('OFFLINE'), HIDE_DELAY)
    const stopHeartbeat = () => {
      if (heartbeat) clearInterval(heartbeat)
      heartbeat = null
    }
    const show = () => {
      hideWrite.cancel()
      showWrite()
      stopHeartbeat()
      heartbeat = setInterval(() => void writeStatus('ONLINE'), HEARTBEAT_INTERVAL)
    }
    const hide = () => {
      showWrite.cancel()
      stopHeartbeat()
      hideWrite()
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? show() : hide())
    const onOnline = () => {
      if (document.visibilityState === 'visible') showWrite()
    }
    const handleUnload = () => {
      showWrite.cancel()
      hideWrite.cancel()

      if (!accessToken) return

      void fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ status: 'OFFLINE' }),
        keepalive: true
      })
    }

    if (document.visibilityState === 'visible') show()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      subscription.unsubscribe()
      stopHeartbeat()
      showWrite.cancel()
      hideWrite.cancel()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [enabled, userId])
}
