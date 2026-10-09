import type { SupabaseClient } from '@supabase/supabase-js'

import type { ChatStore } from '../types'

// A room list past this is not a heading list any agent can use.
const MAX_ROOMS = 1000

// PostgREST errors carry `details` with the failing row, which is chat text. Only the code leaves.
const failed = (method: keyof ChatStore, error: { code?: string }): Error =>
  new Error(`chat ${method} failed: ${error.code ?? 'unknown'}`)

// A one-to-one embed arrives as an object; older PostgREST shapes send an array.
const embedded = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null)

interface RoomRow {
  heading_id: string
  last_activity_at: string | null
  channel_message_counts: { message_count: number } | { message_count: number }[] | null
}

interface MessageRow {
  seq: number
  content: string | null
  type: string | null
  created_at: string
  reply_to_message_id: string | null
  medias: unknown
  author: { username: string | null } | { username: string | null }[] | null
}

/**
 * Service role, never the caller's token. The document gate in the tools decides access.
 * A room is keyed by (workspace_id, heading_id), so every query scopes to the document (#402).
 */
export const createChatStore = (supabase: SupabaseClient): ChatStore => ({
  listRooms: async (documentId) => {
    const { data, error } = await supabase
      .from('channels')
      .select('heading_id, last_activity_at, channel_message_counts(message_count)')
      .eq('workspace_id', documentId)
      .eq('type', 'PUBLIC')
      .is('deleted_at', null)
      .limit(MAX_ROOMS)
    if (error) throw failed('listRooms', error)
    return ((data ?? []) as RoomRow[]).map((row) => ({
      sectionId: row.heading_id,
      messageCount: embedded(row.channel_message_counts)?.message_count ?? 0,
      lastActivityAt: row.last_activity_at
    }))
  },

  findRoom: async (documentId, headingId) => {
    const { data, error } = await supabase
      .from('channels')
      .select('id')
      .eq('workspace_id', documentId)
      .eq('heading_id', headingId)
      .eq('type', 'PUBLIC')
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw failed('findRoom', error)
    return (data as { id: string } | null)?.id ?? null
  },

  readThread: async (documentId, channelId, { beforeSeq, limit }) => {
    let query = supabase
      .from('messages')
      .select(
        'seq, content, type, created_at, reply_to_message_id, medias, author:users!messages_user_id_fkey(username), room:channels!inner(workspace_id, type, deleted_at)'
      )
      .eq('channel_id', channelId)
      .eq('room.workspace_id', documentId)
      .eq('room.type', 'PUBLIC')
      .is('room.deleted_at', null)
      .is('deleted_at', null)
    if (beforeSeq !== undefined) query = query.lt('seq', beforeSeq)
    // One extra row tells whether an older page exists.
    const { data, error } = await query.order('seq', { ascending: false }).limit(limit + 1)
    if (error) throw failed('readThread', error)
    const rows = (data ?? []) as MessageRow[]
    return {
      hasMore: rows.length > limit,
      messages: rows
        .slice(0, limit)
        .reverse()
        .map((row) => ({
          seq: Number(row.seq),
          username: embedded(row.author)?.username ?? null,
          createdAt: row.created_at,
          content: row.content ?? '',
          type: row.type ?? 'text',
          isReply: row.reply_to_message_id !== null,
          attachmentCount: Array.isArray(row.medias) ? row.medias.length : 0
        }))
    }
  },

  // The webapp's first-send shape (`persistChatMessage`), so the feed and triggers treat it alike.
  postMessage: async ({ id, channelId, userId, content, html }) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        id,
        channel_id: channelId,
        user_id: userId,
        content,
        html,
        reply_to_message_id: null
      })
      .select('seq')
      .single()
    if (error) throw failed('postMessage', error)
    return { seq: Number((data as { seq: number }).seq) }
  }
})
