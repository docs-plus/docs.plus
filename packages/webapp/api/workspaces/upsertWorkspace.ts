import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@types'

type TInsert = Database['public']['Tables']['workspaces']['Insert']
type TRow = Database['public']['Tables']['workspaces']['Row']

export const upsertWorkspace = async (workspace: TInsert): Promise<PostgrestResponse<TRow>> => {
  return supabaseClient.from('workspaces').upsert(workspace).select()
}
