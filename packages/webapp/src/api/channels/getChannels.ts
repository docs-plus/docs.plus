import type { PostgrestResponse } from '@supabase/supabase-js'
import type { Channel } from '@types'
import { supabaseClient } from '@utils/supabase'

type UnreadCountRow = {
  channel_id: string
  unread_message_count: number | null
}

async function fetchUnreadCountsBestEffort(
  userId: string,
  channelIds: string[]
): Promise<UnreadCountRow[] | null> {
  if (channelIds.length === 0) {
    return null
  }

  const [outcome] = await Promise.allSettled([
    supabaseClient
      .from('channel_members')
      .select('channel_id, unread_message_count')
      .eq('member_id', userId)
      .in('channel_id', channelIds)
  ])

  if (outcome.status === 'rejected') {
    return null
  }

  const res = outcome.value
  if (res.error) {
    return null
  }

  return res.data ?? null
}

/** Supabase list responses use `PostgrestResponse<R>` with `data: R[]` (do not pass `R[]` as `R` or you get `R[][]`). */
export const getChannels = async (
  workspaceId: string,
  userId?: string
): Promise<PostgrestResponse<Channel>> => {
  const channelsQuery = supabaseClient
    .from('channels')
    .select(
      `
      *,
      count:channel_message_counts(message_count)::int
    `
    )
    .eq('workspace_id', workspaceId)
    .neq('type', 'THREAD')
    .order('last_activity_at', { ascending: false })
    .returns<Channel[]>()

  if (!userId) {
    const result = await channelsQuery
    if (result.error) {
      throw result.error
    }
    return result
  }

  const channelsResult = await channelsQuery

  if (channelsResult.error) {
    throw channelsResult.error
  }

  const channels = channelsResult.data ?? []

  if (channels.length === 0) {
    return channelsResult
  }

  const channelIds = channels.map((c) => c?.id).filter((id): id is string => Boolean(id))
  const unreadRows = await fetchUnreadCountsBestEffort(userId, channelIds)

  const unreadCountsMap: Record<string, number> = {}
  if (unreadRows) {
    for (const item of unreadRows) {
      if (item?.channel_id) {
        unreadCountsMap[item.channel_id] = item.unread_message_count ?? 0
      }
    }
  }

  const channelsWithUnreadCounts = channels.map((channel) => {
    if (!channel) return channel
    return {
      ...channel,
      unread_message_count: channel.id ? (unreadCountsMap[channel.id] ?? 0) : 0
    }
  })

  return { ...channelsResult, data: channelsWithUnreadCounts }
}

export const getChannelsWithMessageCounts = async (
  workspaceId: string
): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channels')
    .select('*, count:channel_message_counts(message_count)::int')
    .eq('workspace_id', workspaceId)
    .neq('type', 'THREAD')
    .returns<Channel[]>()
    .throwOnError()
}

export const getChannelsByWorkspaceAndUserids = async (
  workspaceId: string,
  userId: string,
  supabase: any
): Promise<PostgrestResponse<any>> => {
  // Query channel_members and join channels
  // Use simpler syntax - Supabase auto-detects foreign keys
  // Alias channels as 'workspace' to match expected response structure
  const result = await supabase
    .from('channel_members')
    .select(
      `
      *,
      workspace:channels(*)
    `
    )
    .eq('member_id', userId)

  if (result.error) {
    // Log full error details for debugging
    console.error('[getChannelsByWorkspaceAndUserids error]:', {
      error: result.error,
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
      code: result.error.code
    })
    throw result.error
  }

  // Filter by workspace_id in memory since PostgREST doesn't support nested filtering well
  const filtered = {
    ...result,
    data: (result.data || []).filter((item: any) => item.workspace?.workspace_id === workspaceId)
  }

  return filtered as PostgrestResponse<any>
}

export const getChannelById = async (channelId: string): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .returns<Channel>()
    .single()
    .throwOnError()
}
