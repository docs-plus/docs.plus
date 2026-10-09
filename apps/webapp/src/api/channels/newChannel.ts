import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TNewChannel = Database['public']['Tables']['channels']['Insert']

/** The five columns that the client INSERT grant allows (#402). Any other column fails with 42501. */
type TClientChannelInsert = Pick<
  TNewChannel,
  'workspace_id' | 'heading_id' | 'created_by' | 'name' | 'slug'
>

/** Clients may not choose `id` (#402). A row that already holds the heading is kept. */
export const upsertChannel = async (newChannelPayload: TClientChannelInsert) => {
  return await supabaseClient
    .from('channels')
    .upsert(newChannelPayload, { onConflict: 'workspace_id,heading_id', ignoreDuplicates: true })
    .select()
    .throwOnError()
}
