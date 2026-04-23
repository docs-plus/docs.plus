// packages/extension-hyperlink/src/ui-controller/index.ts
//
// Compat shim — internal-only. Removed in Task 11.
export type {
  ControllerState,
  ManagedPopover as ManagedSurface,
  PopoverKind as SurfaceKind,
  VirtualCoordinates
} from '../floating-popover'
export {
  createPopoverController as createHyperlinkUIController,
  getDefaultController,
  type PopoverController as HyperlinkUIController,
  resetDefaultController,
  setDefaultController
} from '../floating-popover'
