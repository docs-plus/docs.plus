import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'
import { PostgrestSingleResponse } from '@supabase/supabase-js'
export type TWorkspaceInsert = Database['public']['Tables']['workspaces']['Insert']
export type TWorkspaceRow = Database['public']['Tables']['workspaces']['Row']

export const createWorkspace = async (
  arg: TWorkspaceInsert
): Promise<PostgrestSingleResponse<TWorkspaceRow>> => {
  return supabaseClient
    .from('workspaces')
    .insert({ ...arg })
    .select()
    .single()
    .throwOnError()
}
