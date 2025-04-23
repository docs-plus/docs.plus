import { supabaseClient } from '@utils/supabase'
import { Channel as TChannel } from '@types'
import { PostgrestResponse } from '@supabase/supabase-js'

export const getChannels = async (
  workspaceId: string,
  userId?: string
): Promise<PostgrestResponse<any>> => {
  // Get channels
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
    .returns<TChannel[]>()

  // If no userId provided, just return channels without unread counts
  if (!userId) {
    const result = await channelsQuery
    if (result.error) {
      throw result.error
    }
    return result
  }

  // Run both queries in parallel
  const [channelsResult, unreadCountsResult] = await Promise.allSettled([
    channelsQuery,
    channelsQuery.then((result) => {
      const channels = result.data || []

      if (channels.length === 0) {
        return {
          data: [],
          count: null,
          status: 200,
          statusText: 'OK',
          error: null
        } as PostgrestResponse<any>
      }

      return supabaseClient
        .from('channel_members')
        .select('channel_id, unread_message_count')
        .eq('member_id', userId)
        .in('channel_id', channels.map((c) => c?.id as string).filter(Boolean))
    })
  ])

  // Handle errors from channel query
  if (channelsResult.status === 'rejected') {
    throw channelsResult.reason
  }

  if (channelsResult.value.error) {
    throw channelsResult.value.error
  }

  const channels = channelsResult.value.data || []

  // If no channels found, return early
  if (channels.length === 0) {
    return channelsResult.value
  }

  // Create a map of channel_id to unread_message_count
  const unreadCountsMap: Record<string, number> = {}

  if (unreadCountsResult.status === 'fulfilled' && unreadCountsResult.value?.data) {
    for (const item of unreadCountsResult.value.data) {
      if (item && item.channel_id) {
        unreadCountsMap[item.channel_id] = item.unread_message_count || 0
      }
    }
  }

  // Merge the unread counts into the channels data
  const channelsWithUnreadCounts = channels.map((channel) => {
    if (!channel) return channel
    return {
      ...channel,
      unread_message_count: channel.id ? unreadCountsMap[channel.id] || 0 : 0
    }
  })

  return { ...channelsResult.value, data: channelsWithUnreadCounts } as PostgrestResponse<any>
}

export const getChannelsWithMessageCounts = async (
  workspaceId: string
): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channels')
    .select('*, count:channel_message_counts(message_count)::int')
    .eq('workspace_id', workspaceId)
    .neq('type', 'THREAD')
    .returns<TChannel[]>()
    .throwOnError()
}

export const getChannelsByWorkspaceAndUserids = async (
  workspaceId: string,
  userId: string
): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channel_members')
    .select('*, workspace:channel_id(*)')
    .eq('channel_id.workspace_id', workspaceId)
    .eq('member_id', userId)
    .returns<TChannel[]>()
    .throwOnError()
}

export const getChannelById = async (channelId: string): Promise<PostgrestResponse<any>> => {
  return supabaseClient
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .returns<TChannel>()
    .single()
    .throwOnError()
}
