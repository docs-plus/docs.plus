import { HoverMenu, type HoverMenuProps } from '@components/ui/HoverMenu'
import { useCallback } from 'react'

const CHAT_HOVER_PORTAL_ID = 'chat-hover-portal'

/**
 * `boundary` is `.message-feed`, not the panel: the panel rect includes the
 * toolbar and composer, so a menu over the toolbar still "fits" and never flips.
 * `scrollParent` is the same node, resolved lazily so mounting before the feed
 * paints keeps visibility tracking. Portal + `z-30` yield to JumpToPresent (z-40).
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
