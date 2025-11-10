import { supabaseClient } from '@utils/supabase'
import { Database } from '@types'

type TMsgPaginnatedArg = {
  input_channel_id: string
  limit_count?: number
  cursor_timestamp?: string | null
  direction?: 'older' | 'newer'
}

type TMsg = Database['public']['Tables']['messages']['Row']
type TPaginationCursors = {
  next_cursor: string | null
  prev_cursor: string | null
  has_more_recent: boolean
  has_more_older: boolean
}

type TMsgResponse = {
  messages: TMsg[] | null
  pagination_cursors: TPaginationCursors
}

export const fetchMessagesPaginated = async (arg: TMsgPaginnatedArg): Promise<TMsgResponse> => {
  return supabaseClient
    .rpc('get_channel_messages_paginated', {
      input_channel_id: arg.input_channel_id,
      limit_count: arg.limit_count || 20,
      cursor_timestamp: arg.cursor_timestamp,
      direction: arg.direction || 'older'
    })
    .single()
    .then((res) => res.data as TMsgResponse)
}
