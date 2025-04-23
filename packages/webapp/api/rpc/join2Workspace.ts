import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@types'

type TJoin2WorkspaceReturn = boolean

type TJoin2WorkspaceParams = {
  workspaceId: string
}

/**
 * Join the current authenticated user to a workspace
 * @param workspaceId - The ID of the workspace to join
 * @returns A promise that resolves to a boolean indicating if the operation was successful
 */
export const join2Workspace = async (
  arg: TJoin2WorkspaceParams
): Promise<PostgrestResponse<TJoin2WorkspaceReturn>> => {
  return supabaseClient.rpc('join_workspace', {
    _workspace_id: arg.workspaceId
  })
}
