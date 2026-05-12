import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Channel as TChannel, Database } from '@types'

import { channelMessageCountsUpsert, channelUpsert } from './helpers'

type TChannelRow = NonNullable<TChannel>
type TChannelMessageCountsRow = Database['public']['Tables']['channel_message_counts']['Row']

export const dbChannelsListener = (payload: RealtimePostgresChangesPayload<TChannelRow>) => {
  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    channelUpsert(payload)
  }
}

export const dbChannelMessageCountsListener = (
  payload: RealtimePostgresChangesPayload<TChannelMessageCountsRow>
) => {
  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    channelMessageCountsUpsert(payload)
  }
}
