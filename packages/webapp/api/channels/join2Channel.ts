import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TNewChannel = Database['public']['Tables']['channel_members']['Insert']

export const join2Channel = async ({ channel_id, member_id }: TNewChannel) =>
  supabaseClient
    .from('channel_members')
    .upsert({ channel_id, member_id })
    .select()
    .single()
    .throwOnError()
