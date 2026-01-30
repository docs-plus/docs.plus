import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TChannelNotifStateArg = Database['public']['Functions']['get_channel_notif_state']['Args']
type TChannelNotifStateReturn =
  Database['public']['Functions']['get_channel_notif_state']['Returns']

export const getChannelNotifState = async (arg: TChannelNotifStateArg): Promise<any> => {
  const { data, error } = await supabaseClient.rpc('get_channel_notif_state', {
    _channel_id: arg._channel_id
  })
  return { data: data as TChannelNotifStateReturn, error }
}
