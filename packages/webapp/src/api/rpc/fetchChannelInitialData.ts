import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TAggregateChannelArg =
  Database['public']['Functions']['get_channel_aggregate_data']['Args']

export type TAggregateChannelData =
  Database['public']['Functions']['get_channel_aggregate_data']['Returns'][number]

export const fetchChannelInitialData = (arg: TAggregateChannelArg) =>
  supabaseClient
    .rpc('get_channel_aggregate_data', {
      input_channel_id: arg.input_channel_id,
      message_limit: arg.message_limit ?? 20,
      anchor_message_id: arg.anchor_message_id ?? null
    })
    .single()
    .then((res) => ({
      data: res.data as TAggregateChannelData,
      error: res.error
    }))
