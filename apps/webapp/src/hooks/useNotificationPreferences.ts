import { getNotificationPreferences } from '@api'
import { useAuthStore } from '@stores'
import { useQuery } from '@tanstack/react-query'
import type { NotificationPreferences } from '@types'

/** Keyed by user, so one person never sees another's cached settings. */
export const notificationPreferencesKey = (userId: string | undefined) =>
  ['notification-preferences', userId] as const

async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await getNotificationPreferences()
  if (error) throw error
  return (data ?? {}) as NotificationPreferences
}

/** The owner's saved preferences. `useProfileSync` invalidates it when any client saves. */
export function useNotificationPreferences() {
  const userId = useAuthStore((state) => state.profile?.id)
  return useQuery({
    queryKey: notificationPreferencesKey(userId),
    queryFn: fetchNotificationPreferences,
    enabled: !!userId,
    retry: 1
  })
}
