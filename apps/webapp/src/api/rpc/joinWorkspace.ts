import { PostgrestResponse } from '@supabase/supabase-js'
import type { Database as _Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TJoin2WorkspaceReturn = boolean

type TJoin2WorkspaceParams = {
  workspaceId: string
}

export const joinWorkspace = async (
  arg: TJoin2WorkspaceParams
): Promise<PostgrestResponse<TJoin2WorkspaceReturn>> => {
  return supabaseClient.rpc('join_workspace', {
    _workspace_id: arg.workspaceId
  })
}
