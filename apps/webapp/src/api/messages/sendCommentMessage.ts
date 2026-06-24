import type { CommentAnchorV1, MessageMediaItem } from '@types'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TMessage = Database['public']['Tables']['messages']['Row']

export type SendCommentMessageOptions = {
  medias?: MessageMediaItem[] | null
  type?: TMessage['type']
}

export async function sendCommentMessage(
  content: TMessage['content'],
  channel_id: TMessage['channel_id'],
  user_id: TMessage['user_id'],
  html: TMessage['html'],
  comment: CommentAnchorV1,
  options?: SendCommentMessageOptions
) {
  return supabaseClient
    .from('messages')
    .insert({
      content,
      channel_id,
      user_id,
      html,
      type: options?.type ?? 'comment',
      metadata: { comment },
      ...(options && 'medias' in options ? { medias: options.medias as TMessage['medias'] } : {})
    })
    .select()
    .returns<TMessage[]>()
    .throwOnError()
}
