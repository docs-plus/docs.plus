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

/** Stable factory refs for `useEditor(..., [])`; reads mobile/surface on each open. */
export function getHyperlinkPopoverConfigAtInvoke(
  getIsMobile: () => boolean,
  getSurface: () => HyperlinkSurface = () => 'pad'
): NonNullable<HyperlinkOptions['popovers']> {
  return {
    previewHyperlink: (opts) =>
      getHyperlinkPopoverConfig(getIsMobile(), getSurface()).previewHyperlink!(opts),
    createHyperlink: (opts) =>
      getHyperlinkPopoverConfig(getIsMobile(), getSurface()).createHyperlink!(opts),
    editHyperlink: (opts) =>
      getHyperlinkPopoverConfig(getIsMobile(), getSurface()).editHyperlink!(opts)
  }
}
