import { ProfileUpdate } from '@types'
import { supabaseClient } from '@utils/supabase'

import { USER_PROFILE_COLUMNS } from './getUserById'

export const updateUser = async (id: string, update: ProfileUpdate) => {
  return supabaseClient
    .from('users')
    .update({ ...update })
    .eq('id', id)
    .select(USER_PROFILE_COLUMNS)
    .maybeSingle()
}
