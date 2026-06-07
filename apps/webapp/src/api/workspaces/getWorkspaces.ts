import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'
type TWorkspace = Database['public']['Tables']['workspaces']['Row']

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getWorkspaces = async (userId: string): Promise<PostgrestResponse<any>> => {
  return (
    supabaseClient
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true })
      // .eq("created_by", userId)
      .returns<TWorkspace[]>()
      .throwOnError()
  )
}
