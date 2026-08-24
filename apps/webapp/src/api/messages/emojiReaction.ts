import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'

/**
 * Writes go through add_reaction / remove_reaction — direct messages.update is
 * RLS-blocked. The RPCs own the row lock for concurrent toggles. Persisted
 * shape stays `{ [emoji]: [{user_id, created_at}] }` so display is unchanged.
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
