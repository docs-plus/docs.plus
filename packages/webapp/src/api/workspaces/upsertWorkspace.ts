import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TInsert = Database['public']['Tables']['workspaces']['Insert']
type TRow = Database['public']['Tables']['workspaces']['Row']

export const upsertWorkspace = async (workspace: TInsert): Promise<PostgrestResponse<TRow>> => {
  // ignoreDuplicates matches RLS: immutable columns must not be rewritten by repeat upserts.
  return supabaseClient
    .from('workspaces')
    .upsert(workspace, { onConflict: 'id', ignoreDuplicates: true })
    .select()
}
