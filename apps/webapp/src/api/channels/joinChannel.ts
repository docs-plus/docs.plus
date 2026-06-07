import { supabaseClient } from '@utils/supabase'

export const joinChannel = async ({ channel_id }: { channel_id: string }) => {
  const uid = (await supabaseClient.auth.getSession()).data.session?.user?.id
  if (!uid) throw new Error('Not authenticated')

  const inserted = await supabaseClient
    .from('channel_members')
    .insert({ channel_id, member_id: uid })
    .select('*, channel:channel_id(*)')
    .maybeSingle()

  if (inserted.data) return inserted

  if (inserted.error && (inserted.error as { code?: string }).code !== '23505') {
    return inserted
  }

  return supabaseClient
    .from('channel_members')
    .select('*, channel:channel_id(*)')
    .eq('channel_id', channel_id)
    .eq('member_id', uid)
    .single()
    .throwOnError()
}
