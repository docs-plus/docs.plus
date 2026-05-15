import { HoverMenu, type HoverMenuProps } from '@components/ui/HoverMenu'
import { useCallback } from 'react'

const CHAT_HOVER_PORTAL_ID = 'chat-hover-portal'

/**
 * Chatroom-specific HoverMenu wrapper:
 *  - `boundary` resolves to `.message-feed` — the region the menu is
 *    allowed to occupy. NOT the whole panel: the panel includes the
 *    toolbar (top) and composer (bottom), so a menu sitting *over the
 *    toolbar* still fits inside the panel rect and wouldn't trigger
 *    a flip. `.message-feed` excludes both, so `top-end` placement of
 *    a top-of-feed message overflows the boundary → flip to `bottom-end`
 *    → menu lands below the message, inside the feed.
 *  - `scrollParent` resolves the Virtuoso scroll container at lookup time
 *    so the underlying HoverMenu mounts before `.message-feed` paints
 *    without losing scroll-driven visibility tracking. Same DOM node as
 *    `boundary`; intentional — the menu is constrained to (and tracks
 *    visibility within) the same scrollable region.
 *  - `portalId` + `menuClassName="z-30"` handle JumpToPresent overlap
 *    (z-40), which is *inside* the boundary and so unfixable by flip.
 */
export const MessageHoverMenu = (props: HoverMenuProps) => {
  const getFeed = useCallback(
    () => (typeof document !== 'undefined' ? document.querySelector('.message-feed') : null),
    []
  )
  return (
    <HoverMenu
      {...props}
      scrollParent={getFeed}
      boundary={getFeed}
      portalId={CHAT_HOVER_PORTAL_ID}
      menuClassName="z-30"
    />
  )
}
