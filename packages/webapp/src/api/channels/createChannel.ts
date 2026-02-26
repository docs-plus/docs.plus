import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TNewChannel = Database['public']['Tables']['channels']['Insert']

export const createChannel = async (newChannelPayload: TNewChannel) =>
  await supabaseClient.from('channels').insert(newChannelPayload).select().single().throwOnError()
