import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TCreateDirectMsgArg = Database['public']['Functions']['create_direct_message_channel']['Args']

export const creatDirectMessageChannel = (arg: TCreateDirectMsgArg) => {
  return supabaseClient.rpc('create_direct_message_channel', {
    workspace_uid: arg.workspace_uid,
    user_id: arg.user_id
  })
}
