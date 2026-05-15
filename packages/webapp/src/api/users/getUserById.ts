import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TUser = Database['public']['Tables']['users']['Row']

/**
 * `email` is intentionally excluded from the column-level GRANT on
 * `public.users` (see scripts/29-lint-hardening.sql §3). `select('*')`
 * fails for both anon and authenticated; the whitelist below mirrors
 * the GRANT so the query lands.
 */
const USER_PROFILE_COLUMNS =
  'id, username, full_name, display_name, avatar_url, avatar_updated_at, profile_data, status, online_at, created_at, updated_at, deleted_at'

export const getUserById = async (userId: string): Promise<PostgrestSingleResponse<TUser>> => {
  return supabaseClient
    .from('users')
    .select(USER_PROFILE_COLUMNS)
    .eq('id', userId)
    .single()
    .throwOnError() as unknown as Promise<PostgrestSingleResponse<TUser>>
}
