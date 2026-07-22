/** Inputs shared by React unread hooks and the heading-widget writer. */
export type UnreadCountSource = {
  channels: Map<string, { unread_message_count?: number | null } | null | undefined>
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
