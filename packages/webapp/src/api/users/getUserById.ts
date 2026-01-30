import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TUser = Database['public']['Tables']['users']['Row']

export const getUserById = async (userId: string): Promise<PostgrestSingleResponse<TUser>> => {
  return supabaseClient.from('users').select('*').eq('id', userId).single().throwOnError()
}
