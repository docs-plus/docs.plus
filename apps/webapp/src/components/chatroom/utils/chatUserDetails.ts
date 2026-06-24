import type { MessageRowUserDetails } from '@components/chatroom/types/chat-items'
import type { Profile } from '@types'

export function profileToMessageRowUserDetails(
  profile: Profile | null | undefined,
  userId: string
): MessageRowUserDetails | null {
  if (!profile) return null
  return {
    id: userId,
    username: profile.username ?? null,
    fullname: profile.full_name ?? profile.fullname ?? null,
    avatar_url: profile.avatar_url ?? null,
    avatar_updated_at: profile.avatar_updated_at ?? null
  }
}
