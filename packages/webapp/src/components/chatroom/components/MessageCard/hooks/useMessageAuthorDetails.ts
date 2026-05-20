import type { MessageRowUserDetails } from '@components/chatroom/types/chat-items'
import { useStore } from '@stores'
import type { TGroupedMsgRow } from '@types'
import { useMemo } from 'react'

const toMessageAuthorDetails = (
  userId: string,
  raw: {
    username?: string | null
    fullname?: string | null
    full_name?: string | null
    avatar_url?: string | null
    avatar_updated_at?: string | null
  }
): MessageRowUserDetails => ({
  id: userId,
  username: raw.username ?? null,
  fullname: raw.fullname ?? raw.full_name ?? null,
  avatar_url: raw.avatar_url ?? null,
  avatar_updated_at: raw.avatar_updated_at ?? null
})

/** Realtime `messages` rows omit `user_details`; fall back to workspace presence profile. */
export const useMessageAuthorDetails = (message: TGroupedMsgRow): MessageRowUserDetails | null => {
  const presenceProfile = useStore((state) =>
    message.user_id ? state.usersPresence.get(message.user_id) : undefined
  )

  return useMemo((): MessageRowUserDetails | null => {
    const ud = message.user_details
    if (ud?.id) return toMessageAuthorDetails(ud.id, ud)

    const userId = message.user_id
    if (!userId) return null

    if (!presenceProfile) {
      return {
        id: userId,
        username: null,
        fullname: null,
        avatar_url: null,
        avatar_updated_at: null
      }
    }

    return toMessageAuthorDetails(userId, presenceProfile)
  }, [message.user_details, message.user_id, presenceProfile])
}
