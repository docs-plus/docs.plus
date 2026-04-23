// packages/extension-hyperlink/src/helpers/floatingToolbar.ts
//
// Compat shim — internal-only. The public symbols moved to
// `src/floating-popover/`. Removed entirely in Task 11 once every
// in-tree caller is migrated. DO NOT add new code that imports from here.
import {
  createPopover,
  DEFAULT_OFFSET,
  getDefaultController,
  type Popover,
  type PopoverOptions,
  type VirtualCoordinates
} from '../floating-popover'

export type FloatingToolbarOptions = PopoverOptions & {
  surface?: 'preview' | 'edit' | 'create' | 'unknown'
}
export type FloatingToolbarInstance = Popover
export const createFloatingToolbar = (options: FloatingToolbarOptions): FloatingToolbarInstance => {
  const { surface, ...rest } = options
  const popover = createPopover(rest)
  if (surface) {
    getDefaultController().adopt(popover, surface)
  }
  return popover
}
export const hideCurrentToolbar = (): void => getDefaultController().close()
export const updateCurrentToolbarPosition = (
  referenceElement?: HTMLElement,
  coordinates?: VirtualCoordinates
): void => getDefaultController().reposition(referenceElement, coordinates)
export { DEFAULT_OFFSET }
