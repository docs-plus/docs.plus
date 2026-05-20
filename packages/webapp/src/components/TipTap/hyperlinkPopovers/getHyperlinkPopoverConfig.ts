import type { HyperlinkOptions } from '@docs.plus/extension-hyperlink'

import { createHyperlinkDesktop, editHyperlinkDesktop } from './desktopPopoverEntries'
import { createHyperlinkMobile, editHyperlinkMobile } from './mobilePopoverEntries'
import previewHyperlink from './previewHyperlink'

/** Single popover wiring for pad + chat composers (desktop floating host vs mobile sheet). */
export function getHyperlinkPopoverConfig(
  isMobile: boolean | undefined
): NonNullable<HyperlinkOptions['popovers']> {
  const mobile = Boolean(isMobile)
  return {
    previewHyperlink,
    createHyperlink: mobile ? createHyperlinkMobile : createHyperlinkDesktop,
    editHyperlink: mobile ? editHyperlinkMobile : editHyperlinkDesktop
  }
}
