import { supabaseClient } from '@utils/supabase'
import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { ProfileUpdate } from '@types'

export const updateUser = async (
  id: string,
  update: ProfileUpdate
): Promise<PostgrestSingleResponse<null>> => {
  return supabaseClient
    .from('users')
    .update({ ...update })
    .eq('id', id)
    .single()
    .throwOnError()
}
