import { supabaseClient } from '@utils/supabase'
import { PostgrestResponse as Response } from '@supabase/supabase-js'

import { Database } from '@types'

type TUser = Database['public']['Tables']['users']['Row']

export const updateUser = async (id: string, data: TUser): Promise<Response<TUser>> => {
  return supabaseClient.from('users').update(data).eq('id', id).select()
}
