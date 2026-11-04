import { Hyperlink } from './hyperlink'

export {
  type AdoptMetadata,
  type ControllerState,
  getDefaultController,
  type PopoverController,
  type PopoverKind,
  type VirtualCoordinates
} from './floating-popover'
export {
  createPopover,
  DEFAULT_OFFSET,
  type Popover,
  type PopoverOptions
} from './floating-popover'
export * from './hyperlink'
export {
  buildPreviewOptionsFromAnchor,
  type BuildPreviewOptionsFromAnchorArgs,
  openCreateHyperlink,
  openEditHyperlink,
  openPreviewHyperlink
} from './openers'
// The caret-inside-a-link test that Mod-K and Alt+Enter use, for host keymaps such as a composer.
export { linkAtSelection } from './openers/linkAtSelection'
// The preview for a link outside any editor, and the keyboard focus rule the editor's preview uses.
export { focusPreviewFromKeyboard } from './openers/focusPreviewFromKeyboard'
export { openPreviewPopover } from './openers/openPreviewPopover'
// The platform Mod test (Cmd on macOS, Ctrl elsewhere) behind the package's Mod-click rule.
export { hasMod } from './interactions/modKey'
// The hovercard's close-key rule, for a host card that must close on the same keys.
export { keepsHovercardOpen } from './hovercard/rules'
export { createHyperlinkPopover, editHyperlinkPopover, previewHyperlinkPopover } from './popovers'
// Tooltip primitive — the same hover/focus bubble the prebuilt popovers
// put on their icon buttons, re-exported for BYO popover parity.
// The bubble is per-bundle: pair attach and hide from the same package.
export { attachTooltip, hideTooltip } from '@docs.plus/floating-tooltip'

// Link icons: the argument type of HyperlinkOptions.linkIcon, two resolver helpers,
// and the guarded call that a host uses outside an editor.
export { linkIconFetcher } from './link-icons/linkIconFetcher'
export { linkIconFor } from './link-icons/linkIconFor'
export { linkIconMap } from './link-icons/linkIconMap'
export type { LinkIconContext, LinkIconResolver } from './link-icons/types'

// Hovercard: the shapes behind HyperlinkOptions.hovercard.
export type {
  HovercardContext,
  HovercardData,
  HovercardOptions,
  HovercardRenderContext,
  HovercardShowContext,
  HovercardView
} from './hovercard/types'

// Paste title: the shapes behind HyperlinkOptions.pasteTitle.
export type { PasteTitleContext, PasteTitleOptions } from './paste-title/types'

// Utilities (validateURL, isSafeHref, …) re-exported for BYO popovers.
export * from './utils'

// Linkify protocol registration — kept for parity with v1.
export { registerCustomProtocol } from 'linkifyjs'

export default Hyperlink
