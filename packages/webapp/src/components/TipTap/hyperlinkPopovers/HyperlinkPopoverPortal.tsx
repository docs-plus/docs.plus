import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { HyperlinkEditor } from './components/HyperlinkEditor'
import { useActivePopover } from './hyperlinkPopoverStore'

/** Single desktop mount point. Lives in the main tree so it inherits QueryClient/theme; portals into the host produced by the desktop popover entries. */
export function HyperlinkPopoverPortal(): ReactNode {
  const active = useActivePopover()
  if (!active) return null
  return createPortal(<HyperlinkEditor {...active.props} variant="desktop" />, active.host)
}
