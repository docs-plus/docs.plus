import { supabaseClient } from '@utils/supabase'
import { PostgrestSingleResponse } from '@supabase/supabase-js'

type UserProfileModal = {
  id: string
  full_name: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
  username: string | null
  profile_data: Record<string, any> | null
}

export const getUserProfileForModal = async (
  userId: string
): Promise<PostgrestSingleResponse<UserProfileModal>> => {
  return supabaseClient
    .from('users')
    .select('id, full_name, avatar_url, avatar_updated_at, username, profile_data')
    .eq('id', userId)
    .single()
}
