import Router from 'next/router'

/**
 * Heading-keyed chat syncs the address bar via `history.pushState` (`h` + `id`).
 * Strip those only when `id` matches the channel being closed so plain doc deep
 * links are not cleared after opening a different heading’s chat.
 */
export function removeChatDeepLinkSearchParams(
  params: URLSearchParams,
  closedHeadingChannelId?: string | null
): boolean {
  let changed = false
  for (const k of ['msg_id', 'chatroom', 'open_heading_chat'] as const) {
    if (params.has(k)) {
      params.delete(k)
      changed = true
    }
  }
  if (params.get('act') === 'ch') {
    params.delete('act')
    params.delete('c_id')
    params.delete('m_id')
    changed = true
  }
  if (
    closedHeadingChannelId &&
    params.get('id') === closedHeadingChannelId &&
    (params.has('h') || params.has('id'))
  ) {
    params.delete('h')
    params.delete('id')
    changed = true
  }
  return changed
}

/** Drops chat / heading-bar query params when the chatroom is torn down (shallow replace). */
export function stripChatDeepLinkFromBrowserUrl(closedHeadingChannelId?: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!removeChatDeepLinkSearchParams(url.searchParams, closedHeadingChannelId)) return
  const next = `${url.pathname}${url.search}${url.hash}`
  void Router.replace(next, undefined, { shallow: true })
}
