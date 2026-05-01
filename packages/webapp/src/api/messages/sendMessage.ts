import type { TMsgRow } from '@types'
import { supabaseClient } from '@utils/supabase'

export interface SendMessageArgs {
  /**
   * Optional client-generated UUID. When provided, Postgres respects
   * it (the `id` column has a default but accepts overrides). Use this
   * to make optimistic UI reconcile cleanly with the realtime echo.
   */
  id?: TMsgRow['id']
  content: TMsgRow['content']
  channel_id: TMsgRow['channel_id']
  user_id: TMsgRow['user_id']
  html: TMsgRow['html']
  reply_to_message_id?: TMsgRow['reply_to_message_id']
}

export const sendMessage = async (args: SendMessageArgs) =>
  await supabaseClient
    .from('messages')
    .insert({
      ...(args.id ? { id: args.id } : {}),
      content: args.content,
      channel_id: args.channel_id,
      user_id: args.user_id,
      html: args.html,
      reply_to_message_id: args.reply_to_message_id ?? null
    })
    .select()
    .returns<TMsgRow[]>()
    .throwOnError()
