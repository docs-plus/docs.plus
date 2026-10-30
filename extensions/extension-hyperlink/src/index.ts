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
export { createHyperlinkPopover, editHyperlinkPopover, previewHyperlinkPopover } from './popovers'
// Tooltip primitive — the same hover/focus bubble the prebuilt popovers
// put on their icon buttons, re-exported for BYO popover parity.
// The bubble is per-bundle: pair attach and hide from the same package.
export { attachTooltip, hideTooltip } from '@docs.plus/floating-tooltip'

// Link icons: the argument type of HyperlinkOptions.linkIcon, and two resolver helpers.
export { linkIconFetcher } from './link-icons/linkIconFetcher'
export { linkIconMap } from './link-icons/linkIconMap'
export type { LinkIconContext } from './link-icons/types'

// Hovercard: the shapes behind HyperlinkOptions.hovercard.
export type { HovercardData, HovercardImageLayout, HovercardOptions } from './hovercard/types'

// Utilities (validateURL, isSafeHref, …) re-exported for BYO popovers.
export * from './utils'

// Linkify protocol registration — kept for parity with v1.
export { registerCustomProtocol } from 'linkifyjs'

export default Hyperlink
