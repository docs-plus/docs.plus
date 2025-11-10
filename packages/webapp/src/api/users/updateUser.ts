import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse } from '@supabase/supabase-js'
import { Profile, ProfileUpdate } from '@types'

export const updateUser = async (
  id: string,
  update: ProfileUpdate
): Promise<PostgrestResponse<Profile>> => {
  return supabaseClient
    .from('users')
    .update({ ...update })
    .eq('id', id)
    .single()
}
