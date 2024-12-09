import { supabaseClient } from '@utils/supabase'
import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { Profile } from '@types'

export const updateUser = async (
  id: string,
  update: Profile
): Promise<PostgrestSingleResponse<null>> => {
  return supabaseClient
    .from('users')
    .update({ ...update })
    .eq('id', id)
    .single()
    .throwOnError()
}
