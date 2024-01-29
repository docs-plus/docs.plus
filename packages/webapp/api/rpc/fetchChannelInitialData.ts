import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TAgChannelDataArg = Database['public']['Functions']['get_channel_aggregate_data']['Args']
type TAgChannelDataReturn =
  Database['public']['Functions']['get_channel_aggregate_data']['Returns'][0]

export const fetchChannelInitialData = (arg: TAgChannelDataArg) =>
  supabaseClient
    .rpc('get_channel_aggregate_data', {
      input_channel_id: arg.input_channel_id,
      message_limit: arg.message_limit || 20
    })
    .single()
    .then((res) => ({ data: res.data as TAgChannelDataReturn, error: res.error }))
