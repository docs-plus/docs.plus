import { supabaseClient } from '@utils/supabase'

type Tupdate = {
  channelId: string
  memberId: string
  notifState: 'all' | 'mentions' | 'muted'
}

export const updateChannelNotifState = async ({ channelId, memberId, notifState }: Tupdate) => {
  return supabaseClient
    .from('channel_members')
    .update({
      notif_state: notifState
    })
    .eq('channel_id', channelId)
    .eq('member_id', memberId)
}
