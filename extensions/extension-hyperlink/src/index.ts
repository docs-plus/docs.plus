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
export {
  buildPreviewOptionsFromAnchor,
  type BuildPreviewOptionsFromAnchorArgs,
  openCreateHyperlink,
  openEditHyperlink,
  openPreviewHyperlink
} from './openers'

// Tooltip primitive — the same hover/focus bubble the prebuilt popovers
// put on their icon buttons, re-exported for BYO popover parity.
// The bubble is per-bundle: pair attach and hide from the same package.
export * from './hyperlink'
export { createHyperlinkPopover, editHyperlinkPopover, previewHyperlinkPopover } from './popovers'
export { attachTooltip, hideTooltip } from '@docs.plus/floating-tooltip'

// Utilities (validateURL, isSafeHref, …) re-exported for BYO popovers.
export * from './utils'

// Linkify protocol registration — kept for parity with v1.
export { registerCustomProtocol } from 'linkifyjs'

export default Hyperlink
