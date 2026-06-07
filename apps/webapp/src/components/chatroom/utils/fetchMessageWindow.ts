import { supabaseClient } from '@utils/supabase'

import {
  type AnchorKind,
  buildItemsFromWindow,
  type MessageWindow,
  parseWindow
} from './messageWindow'

export type FetchMessageWindowParams = {
  channelId: string
  anchorKind: AnchorKind | 'before_seq'
  anchorValue?: string
  beforeLimit: number
  afterLimit: number
}

export async function fetchMessageWindow(
  params: FetchMessageWindowParams
): Promise<{ win: MessageWindow; items: ReturnType<typeof buildItemsFromWindow> } | null> {
  const { data, error } = await supabaseClient.rpc('fetch_message_window', {
    p_channel_id: params.channelId,
    p_anchor_kind: params.anchorKind,
    p_anchor_value: params.anchorValue,
    p_before_limit: params.beforeLimit,
    p_after_limit: params.afterLimit
  })
  if (error || !data) return null
  const win = parseWindow(data)
  const buildAnchor = params.anchorKind === 'before_seq' ? 'tail' : params.anchorKind
  const items = buildItemsFromWindow(win, params.channelId, buildAnchor)
  return { win, items }
}
