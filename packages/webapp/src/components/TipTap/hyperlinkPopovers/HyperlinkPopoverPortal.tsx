import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { HyperlinkEditor } from './components/HyperlinkEditor'
import { useActivePopover } from './hyperlinkPopoverStore'

let portalOwner: symbol | null = null

/**
 * Desktop hyperlink create/edit UI. Mount **once** per page (e.g. `DesktopEditor`,
 * `pages/editor.tsx`). Do not mount inside `MessageComposer` when the document
 * layout already provides this — duplicate mounts portal two editors into one host.
 */
export function HyperlinkPopoverPortal(): ReactNode {
  const active = useActivePopover()
  const ownsPortalRef = useRef(false)

  if (!ownsPortalRef.current && portalOwner === null) {
    portalOwner = Symbol('hyperlink-popover-portal')
    ownsPortalRef.current = true
  }

  useEffect(() => {
    return () => {
      if (ownsPortalRef.current) {
        portalOwner = null
        ownsPortalRef.current = false
      }
    }
  }, [])

  if (!active || !ownsPortalRef.current) return null

  return createPortal(<HyperlinkEditor {...active.props} variant="desktop" />, active.host)
}
