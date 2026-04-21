import { Hyperlink } from './hyperlink'

/**
 * Floating-toolbar surface that ships as part of the public package.
 *
 * The two types are referenced by the README's "Public types" section.
 * `hideCurrentToolbar` and `updateCurrentToolbarPosition` are documented
 * as the supported way for popover content to control the surrounding
 * toolbar; both are also pinned by the e2e suite (`custom-popover.cy.ts`).
 *
 * `createFloatingToolbar` and `DEFAULT_OFFSET` stay module-private:
 * they exist for the prebuilt popovers and the click handler inside
 * this package, and exposing them would invite consumers to create
 * orphan toolbars that bypass the singleton-replacement contract.
 */
export {
  type FloatingToolbarInstance,
  type FloatingToolbarOptions,
  hideCurrentToolbar,
  updateCurrentToolbarPosition
} from './helpers/floatingToolbar'
export * from './hyperlink'
export * from './popovers'
export * from './utils'
export { registerCustomProtocol } from 'linkifyjs'

export default Hyperlink
