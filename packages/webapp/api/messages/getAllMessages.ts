import { Database, Profile } from '@types'
import { supabaseClient } from '@utils/supabase'

export type TMessage = Database['public']['Tables']['messages']['Row']

export const getAllMessages = async (channelId: string) =>
  await supabaseClient
    .from('messages')
    .select('*, user_id( username , id , avatar_url ), reply_to_message_id( user_id( username ))')
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .returns<TMessageWithUser[]>()
    .throwOnError()

export type TMessageWithUser = TMessage & {
  id: string
  created_at: string
  updated_at: string
  deleted_at?: any
  edited_at?: any
  content: string
  html: string
  media_urls?: any
  readed_at: string | null
  user_id: {
    username: string
    id: string
    avatar_url: string
  }
  channel_id: string
  reactions?: any
  type?: any
  metadata?: any
  reply_to_message_id?: {
    user_id: {
      username: string
    }
  }
  replied_message_details: {
    message: TMessage
    user: Profile
  }
  user_details: any | null
  replied_message_preview?: any
  original_message_id?: any
  isGroupEnd: boolean
  isGroupStart: boolean
  isNewGroupById: boolean
}
