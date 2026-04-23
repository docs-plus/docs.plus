import { Hyperlink } from './hyperlink'

// Layer 1 — three named openers (the 90% case).
export {
  buildPreviewOptionsFromAnchor,
  type BuildPreviewOptionsFromAnchorArgs,
  openCreateHyperlink,
  openEditHyperlink,
  openPreviewHyperlink
} from './openers'

// Layer 2 — generic controller for lifecycle observation (the 10% case).
export {
  type AdoptMetadata,
  type ControllerState,
  getDefaultController,
  type PopoverController,
  type PopoverKind,
  type VirtualCoordinates
} from './floating-popover'

// Primitive — fully custom popover that still participates in the
// singleton lifecycle (the <1% case).
export {
  createPopover,
  DEFAULT_OFFSET,
  type Popover,
  type PopoverOptions
} from './floating-popover'

// Extension + factories + option types
export * from './hyperlink'
export { createHyperlinkPopover, editHyperlinkPopover, previewHyperlinkPopover } from './popovers'

// Utilities (validateURL, isSafeHref, …) re-exported for BYO popovers.
export * from './utils'

// Linkify protocol registration — kept for parity with v1.
export { registerCustomProtocol } from 'linkifyjs'

export default Hyperlink
