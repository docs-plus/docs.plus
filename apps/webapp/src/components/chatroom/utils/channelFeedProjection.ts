import type { MessageRow } from '@components/chatroom/types/chat-items'

import { parseMessageMedias } from './messageMediaPaths'

export type ChannelFeedMode = 'all' | 'media-only'

export const isMediaOnlyFeedMode = (mode: ChannelFeedMode): boolean => mode === 'media-only'

export const messageHasMedia = (row: { medias?: unknown } | null | undefined): boolean =>
  parseMessageMedias(row?.medias).length > 0

export const shouldIncludeMessageInFeed = (
  row: { medias?: unknown; deleted_at?: string | null } | null | undefined,
  mode: ChannelFeedMode
): boolean => {
  if (!row || row.deleted_at) return false
  if (mode === 'all') return true
  return messageHasMedia(row)
}

export const messageItemVisibleInFeed = (
  item: { row?: MessageRow | null },
  mode: ChannelFeedMode
): boolean => shouldIncludeMessageInFeed(item.row, mode)

export const showOptimisticMessageInFeed = (mode: ChannelFeedMode, medias: unknown): boolean =>
  !isMediaOnlyFeedMode(mode) || messageHasMedia({ medias })

export type FeedWindowRpc = 'fetch_message_window' | 'fetch_media_message_window'

export const feedWindowRpc = (mode: ChannelFeedMode): FeedWindowRpc =>
  isMediaOnlyFeedMode(mode) ? 'fetch_media_message_window' : 'fetch_message_window'

export type FeedCatchupRpc = 'fetch_messages_since' | 'fetch_media_messages_since'

export const feedCatchupRpc = (mode: ChannelFeedMode): FeedCatchupRpc =>
  isMediaOnlyFeedMode(mode) ? 'fetch_media_messages_since' : 'fetch_messages_since'

export const feedUsesTailAnchor = (mode: ChannelFeedMode): boolean => isMediaOnlyFeedMode(mode)

export type FeedWindowScenario =
  | {
      kind: 'initial'
      channelId: string
      anchorKind: string
      anchorValue?: string | null
      pageLimit: number
    }
  | { kind: 'older'; channelId: string; beforeSeq: number; pageLimit: number }

/** RPC name + body for fetch_message_window / fetch_media_message_window. */
export const feedWindowRpcBody = (
  mode: ChannelFeedMode,
  scenario: FeedWindowScenario
): { rpc: FeedWindowRpc; body: Record<string, unknown> } => {
  const rpc = feedWindowRpc(mode)
  if (isMediaOnlyFeedMode(mode)) {
    const beforeSeq = scenario.kind === 'older' ? scenario.beforeSeq : undefined
    return {
      rpc,
      body: {
        p_channel_id: scenario.channelId,
        p_before_seq: beforeSeq,
        p_limit: scenario.pageLimit
      }
    }
  }
  if (scenario.kind === 'initial') {
    return {
      rpc,
      body: {
        p_channel_id: scenario.channelId,
        p_anchor_kind: scenario.anchorKind,
        p_anchor_value: scenario.anchorValue ?? undefined,
        p_before_limit: scenario.pageLimit,
        p_after_limit: scenario.pageLimit
      }
    }
  }
  return {
    rpc,
    body: {
      p_channel_id: scenario.channelId,
      p_anchor_kind: 'before_seq',
      p_anchor_value: String(scenario.beforeSeq),
      p_before_limit: scenario.pageLimit,
      p_after_limit: 0
    }
  }
}
