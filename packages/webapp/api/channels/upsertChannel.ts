import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TNewChannel = Database['public']['Tables']['channels']['Insert']

export const UpsertChannel = async (newChannelPayload: TNewChannel) =>
  await supabaseClient.from('channels').upsert(newChannelPayload).select().throwOnError()
