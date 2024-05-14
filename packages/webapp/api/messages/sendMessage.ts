import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TMessage = Database['public']['Tables']['messages']['Row']

export const sendMessage = async (
  content: TMessage['content'],
  channel_id: TMessage['channel_id'],
  user_id: TMessage['user_id'],
  html: TMessage['html'],
  reply_to_message_id: TMessage['reply_to_message_id']
) =>
  await supabaseClient
    .from('messages')
    .insert({
      content,
      channel_id,
      user_id,
      html,
      reply_to_message_id
    })
    .select()
    .returns<TMessage[]>()
    .throwOnError()

export const sendThreadMessage = async (
  content: TMessage['content'],
  channel_id: TMessage['channel_id'],
  user_id: TMessage['user_id'],
  html: TMessage['html'],
  thread_id: TMessage['thread_id']
) =>
  await supabaseClient
    .from('messages')
    .insert({
      content,
      channel_id,
      user_id,
      html,
      thread_id
    })
    .select()
    .returns<TMessage[]>()
    .throwOnError()
