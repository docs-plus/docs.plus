type ChannelUnreadRow = {
  heading_id?: string | null
  unread_message_count?: number | null
}

/** Inputs shared by React unread hooks and the heading-widget writer. */
export type UnreadCountSource = {
  channels: Map<string, ChannelUnreadRow | null | undefined>
  optimisticUnread: Map<string, number>
  unreadSuppressedChannelId: string | null | undefined
}

/** Channel unread after suppress + optimistic overlay (Heading Chat Surface). */
export function resolveUnreadCount(channelId: string, source: UnreadCountSource): number {
  if (!channelId) return 0
  if (source.unreadSuppressedChannelId === channelId) return 0
  const optimistic = source.optimisticUnread.get(channelId)
  if (typeof optimistic === 'number') return optimistic
  return source.channels.get(channelId)?.unread_message_count ?? 0
}

// Every TOC row runs this on each chat-store update. Immer gives `channels` a new
// identity only when channels change, so the index builds once per change.
const byHeadingCache = new WeakMap<UnreadCountSource['channels'], Map<string, string>>()

const getByHeading = (channels: UnreadCountSource['channels']): Map<string, string> => {
  let by = byHeadingCache.get(channels)
  if (by) return by
  by = new Map<string, string>()
  for (const [channelId, row] of channels) {
    const headingId = row?.heading_id
    // Keep the first row in Map order, so the winner matches a linear scan.
    if (headingId && !by.has(headingId)) by.set(headingId, channelId)
  }
  byHeadingCache.set(channels, by)
  return by
}

/**
 * The store keys rows by channel id, and a heading-side reader has a toc-id (#402).
 * An old row keeps id = heading_id, so the direct hit is the common case.
 */
function headingChannelId(headingId: string, channels: UnreadCountSource['channels']): string {
  if (!headingId) return ''
  if (channels.get(headingId)?.heading_id === headingId) return headingId
  return getByHeading(channels).get(headingId) ?? ''
}

/** Unread for a heading's chat, through its channel row in this document. */
export function resolveHeadingUnreadCount(headingId: string, source: UnreadCountSource): number {
  return resolveUnreadCount(headingChannelId(headingId, source.channels), source)
}
