import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'

/**
 * v2 reaction writes go through the add_reaction / remove_reaction RPCs.
 * Direct messages.update is blocked by RLS post-chat-security-hardening,
 * and the RPCs are SECURITY DEFINER so they own the row lock for
 * concurrent toggles. Persisted shape stays
 * { [emoji]: [{user_id, created_at}, …] } so display consumers
 * (ReactionList, AddReactionButton) are unaffected.
 */
export const emojiReaction = async (message: { id: string }, newReaction: string) => {
  const user = useAuthStore.getState().profile
  if (!user) return
  return supabaseClient
    .rpc('add_reaction', { p_message_id: message.id, p_emoji: newReaction })
    .throwOnError()
}

export const removeReaction = async (message: { id: string }, reaction: string) => {
  const user = useAuthStore.getState().profile
  if (!user) return
  return supabaseClient
    .rpc('remove_reaction', { p_message_id: message.id, p_emoji: reaction })
    .throwOnError()
}
