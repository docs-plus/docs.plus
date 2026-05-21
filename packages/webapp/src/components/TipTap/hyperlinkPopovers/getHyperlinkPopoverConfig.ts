import type { HyperlinkOptions } from '@docs.plus/extension-hyperlink'

import {
  createHyperlinkComposerMobile,
  editHyperlinkComposerMobile,
  previewComposerHyperlink
} from './composerMobilePopoverEntries'
import { createHyperlinkDesktop, editHyperlinkDesktop } from './desktopPopoverEntries'
import { createHyperlinkMobile, editHyperlinkMobile } from './mobilePopoverEntries'
import previewHyperlink from './previewHyperlink'
import type { HyperlinkSurface } from './types'

/** Single popover wiring for pad + chat composers (desktop floating host vs mobile sheet). */
export function getHyperlinkPopoverConfig(
  isMobile: boolean | undefined,
  surface: HyperlinkSurface = 'pad'
): NonNullable<HyperlinkOptions['popovers']> {
  const mobile = Boolean(isMobile)
  if (mobile && surface === 'composer') {
    return {
      previewHyperlink: previewComposerHyperlink,
      createHyperlink: createHyperlinkComposerMobile,
      editHyperlink: editHyperlinkComposerMobile
    }
  }
  return {
    previewHyperlink,
    createHyperlink: mobile ? createHyperlinkMobile : createHyperlinkDesktop,
    editHyperlink: mobile ? editHyperlinkMobile : editHyperlinkDesktop
  }
}
