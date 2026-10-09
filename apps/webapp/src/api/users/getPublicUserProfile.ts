import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

type PublicUserProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
  username: string | null
  profile_data: Record<string, any> | null
}

export const getPublicUserProfile = async (
  userId: string
): Promise<PostgrestSingleResponse<PublicUserProfile>> => {
  return supabaseClient
    .from('users')
    .select('id, full_name, avatar_url, avatar_updated_at, username, profile_data')
    .eq('id', userId)
    .single()
}
