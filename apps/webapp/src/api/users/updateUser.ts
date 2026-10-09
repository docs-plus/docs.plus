import { ProfileUpdate } from '@types'
import { supabaseClient } from '@utils/supabase'

export const updateUser = async (id: string, update: ProfileUpdate) => {
  return supabaseClient
    .from('users')
    .update({ ...update })
    .eq('id', id)
}
