import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TMessage = Database['public']['Tables']['messages']['Row']

export const sendCommentMessage = async (
  content: TMessage['content'],
  channel_id: TMessage['channel_id'],
  user_id: TMessage['user_id'],
  html: TMessage['html'],
  comment: {
    content: string
    html: string
  }
) =>
  await supabaseClient
    .from('messages')
    .insert({
      content,
      channel_id,
      user_id,
      html,
      metadata: {
        comment
      }
    })
    .select()
    .returns<TMessage[]>()
    .throwOnError()
