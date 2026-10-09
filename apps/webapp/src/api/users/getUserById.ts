import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

// No client can read these columns (#434). get_notification_preferences() serves the owner's preferences.
export type TUser = Omit<
  Database['public']['Tables']['users']['Row'],
  'notification_preferences' | 'status' | 'online_at'
>

/**
 * The column-level GRANT on `public.users` leaves out `email`, `status` and
 * `online_at` (#434), so `select('*')` fails for anon and authenticated. This
 * list mirrors the GRANT.
 */
export const USER_PROFILE_COLUMNS =
  'id, username, full_name, display_name, avatar_url, avatar_updated_at, profile_data, created_at, updated_at, deleted_at'

export const getUserById = async (userId: string): Promise<PostgrestSingleResponse<TUser>> => {
  // `maybeSingle()` returns `data: null` when the row is missing, instead of throwing
  // the misleading "Cannot coerce the result to a single JSON object". A local DB
  // reset that orphans a JWT is one such case. Callers must handle null.
  return supabaseClient
    .from('users')
    .select(USER_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle() as unknown as Promise<PostgrestSingleResponse<TUser>>
}
