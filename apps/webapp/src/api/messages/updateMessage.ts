import type { MessageMediaItem } from '@types'
import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TMessage = Database['public']['Tables']['messages']['Row']

export type UpdateMessageOptions = {
  medias?: MessageMediaItem[] | null
  type?: TMessage['type']
}

export const updateMessage = async (
  content: TMessage['content'],
  html: TMessage['html'],
  id: TMessage['id'],
  options?: UpdateMessageOptions
) => {
  const payload: Database['public']['Tables']['messages']['Update'] = {
    content,
    html
  }

  if (options && 'medias' in options) {
    payload.medias = options.medias as TMessage['medias']
  }
  if (options?.type != null) {
    payload.type = options.type
  }

  return supabaseClient
    .from('messages')
    .update(payload)
    .eq('id', id)
    .select()
    .returns<TMessage[]>()
    .throwOnError()
}
