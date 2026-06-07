import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TNewChannel = Database['public']['Tables']['channels']['Insert']

export const upsertChannel = async (newChannelPayload: TNewChannel) => {
  return await supabaseClient
    .from('channels')
    .upsert(newChannelPayload, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .throwOnError()
}
