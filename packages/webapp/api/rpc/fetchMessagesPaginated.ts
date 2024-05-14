import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TMsgPaginnatedArg = Database['public']['Functions']['get_channel_messages_paginated']['Args']
type TMsg = Database['public']['Tables']['messages']['Row']
type Tmsg = {
  messages: TMsg[] | null
}
export const fetchMessagesPaginated = async (arg: TMsgPaginnatedArg): Promise<Tmsg> => {
  return supabaseClient
    .rpc('get_channel_messages_paginated', {
      input_channel_id: arg.input_channel_id,
      page: arg.page,
      page_size: arg.page_size
    })
    .single()
    .then((res) => res.data as Tmsg)
}
