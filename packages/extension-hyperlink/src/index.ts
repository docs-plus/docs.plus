import { Hyperlink } from './hyperlink'

// Public package exports. `createFloatingToolbar` always registers via
// `getDefaultController()`, so consumers cannot build orphan toolbars
// that bypass the controller's singleton-replacement — exposing it lets
// BYO popovers re-mount the preview surface from an edit-popover
// `onBack`, mirroring the prebuilt `previewHyperlinkPopover`.
export {
  createFloatingToolbar,
  DEFAULT_OFFSET,
  type FloatingToolbarInstance,
  type FloatingToolbarOptions,
  hideCurrentToolbar,
  updateCurrentToolbarPosition
} from './helpers/floatingToolbar'
export * from './hyperlink'
export * from './popovers'
// `getDefaultController()` is the entry point for `.subscribe(...)` observers.
export { getDefaultController, type HyperlinkUIController } from './ui-controller'
export * from './utils'
export { registerCustomProtocol } from 'linkifyjs'

export default Hyperlink
