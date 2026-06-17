import type { CommentAnchorV1, Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TMessage = Database['public']['Tables']['messages']['Row']

export async function sendCommentMessage(
  content: TMessage['content'],
  channel_id: TMessage['channel_id'],
  user_id: TMessage['user_id'],
  html: TMessage['html'],
  comment: CommentAnchorV1
) {
  return supabaseClient
    .from('messages')
    .insert({
      content,
      channel_id,
      user_id,
      html,
      type: 'comment',
      metadata: { comment }
    })
    .select()
    .returns<TMessage[]>()
    .throwOnError()
}
