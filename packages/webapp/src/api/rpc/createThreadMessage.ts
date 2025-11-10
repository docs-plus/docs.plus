import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TCreateDirectMsgArg = Database['public']['Functions']['create_thread_message']['Args']

export const createThreadMessage = async (arg: TCreateDirectMsgArg) =>
  await supabaseClient.rpc('create_thread_message', {
    p_content: arg.p_content,
    p_html: arg.p_html,
    p_thread_id: arg.p_thread_id,
    p_workspace_id: arg.p_workspace_id
  })
