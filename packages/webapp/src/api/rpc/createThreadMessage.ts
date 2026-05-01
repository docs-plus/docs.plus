import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TCreateThreadMessageArgs = Database['public']['Functions']['create_thread_message']['Args']

export const createThreadMessage = async (arg: TCreateThreadMessageArgs) =>
  await supabaseClient.rpc('create_thread_message', arg)
