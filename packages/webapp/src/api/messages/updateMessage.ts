import { Database } from '@types'
import { supabaseClient } from '@utils/supabase'

type TMessage = Database['public']['Tables']['messages']['Row']

export const updateMessage = async (
  content: TMessage['content'],
  html: TMessage['html'],
  id: TMessage['id']
) =>
  await supabaseClient
    .from('messages')
    .update({
      content,
      html
    })
    .eq('id', id)
    .select()
    .returns<TMessage[]>()
    .throwOnError()
