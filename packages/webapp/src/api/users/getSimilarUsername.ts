import { PostgrestResponse as Response } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TUser = Database['public']['Tables']['users']['Row']

type TUserUsernameOnly = Pick<TUser, 'username'>

export const getSimilarUsername = async (
  username: string
): Promise<Response<TUserUsernameOnly>> => {
  return supabaseClient.from('users').select('username').eq('username', username)
}
