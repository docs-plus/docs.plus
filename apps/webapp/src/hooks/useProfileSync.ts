import { getUserById } from '@api'
import { useAuthStore } from '@stores'
import { useQueryClient } from '@tanstack/react-query'
import type { Profile } from '@types'
import { subscribePrivateTopic } from '@utils/supabase/subscribePrivateTopic'
import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
import { useEffect } from 'react'

import { notificationPreferencesKey } from './useNotificationPreferences'

// The columns `users_profile_changed` watches, minus the private preferences.
// `status` stays local: it is this tab's own presence.
const SYNCED_FIELDS = [
  'username',
  'full_name',
  'display_name',
  'avatar_url',
  'avatar_updated_at',
  'profile_data'
] as const

/**
 * Keeps the signed-in profile and notification settings current across tabs and devices.
 * The `profile:<uid>` signal carries no values, and Realtime keeps no backlog, so a tab
 * that comes back into view refetches as well.
 */
export function useProfileSync() {
  const userId = useAuthStore((state) => state.profile?.id)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return
    let stale = false
    let latestRefresh = 0

    // The echo of an earlier save can land before a later save's answer and briefly show
    // the earlier value; that save's own answer and echo then settle it.
    const refresh = async () => {
      const run = ++latestRefresh
      void queryClient.invalidateQueries({ queryKey: notificationPreferencesKey(userId) })
      const { data } = await getUserById(userId)
      const current = useAuthStore.getState().profile
      // Two quick signals can answer out of order; only the newest read may write.
      if (stale || run !== latestRefresh || !data || current?.id !== userId) return
      const fresh = pick(data, SYNCED_FIELDS) as Partial<Profile>
      if (isEqual(pick(current, SYNCED_FIELDS), fresh)) return
      useAuthStore.getState().setProfile({ ...current, ...fresh })
    }

    const unsubscribe = subscribePrivateTopic(`profile:${userId}`, (channel) => {
      channel.on('broadcast', { event: 'profile_changed' }, () => void refresh())
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stale = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      unsubscribe()
    }
  }, [userId, queryClient])
}
