import type { TMsgRow } from '@types'
import { supabaseClient } from '@utils/supabase'

export const sendMessage = async (
  content: TMsgRow['content'],
  channel_id: TMsgRow['channel_id'],
  user_id: TMsgRow['user_id'],
  html: TMsgRow['html'],
  reply_to_message_id: TMsgRow['reply_to_message_id']
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
    .returns<TMsgRow[]>()
    .throwOnError()

export const sendThreadMessage = async (
  content: TMsgRow['content'],
  channel_id: TMsgRow['channel_id'],
  user_id: TMsgRow['user_id'],
  html: TMsgRow['html'],
  thread_id: TMsgRow['thread_id']
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
    .returns<TMsgRow[]>()
    .throwOnError()
