import { getPublicUserProfile } from '@api'
import type { MessageRowUserDetails } from '@components/chatroom/types/chat-items'
import { useQuery } from '@tanstack/react-query'
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

const fetchMessageAuthor = async (userId: string): Promise<MessageRowUserDetails> => {
  const { data, error } = await getPublicUserProfile(userId)
  if (error) throw error
  return toMessageAuthorDetails(userId, data)
}

/**
 * Realtime rows omit `user_details`, so load the author's public profile.
 * Never use presence here, because any client can forge a presence payload.
 * `isLoading` is false for a hydrated row and after a failed read, so a loader always ends.
 */
export const useMessageAuthorDetails = (message: TGroupedMsgRow) => {
  const userId = message.user_id
  const { data: profile, isLoading } = useQuery({
    queryKey: ['chat-author', userId],
    queryFn: () => fetchMessageAuthor(userId),
    enabled: !message.user_details?.id && !!userId,
    staleTime: Infinity,
    // A missing user row stays missing, so a retry only delays the id-only avatar.
    retry: false
  })

  const author = useMemo((): MessageRowUserDetails | null => {
    const ud = message.user_details
    if (ud?.id) return toMessageAuthorDetails(ud.id, ud)
    if (!userId) return null
    return profile ?? toMessageAuthorDetails(userId, {})
  }, [message.user_details, userId, profile])

  return { author, isLoading }
}
