// packages/extension-hyperlink/src/floating-popover/controller.ts
//
// Extension-agnostic single-popover lifecycle owner.
//
// `adopt(popover, kind)` takes ownership of an already-built `Popover`,
// destroying the previous owner. `close()` hides the current popover and
// drops to idle. `reposition()` re-anchors. `subscribe(fn)` observes
// idle ↔ mounted transitions.

export type PopoverKind = 'preview' | 'edit' | 'create' | (string & {})

export type VirtualCoordinates = {
  getBoundingClientRect: () => { x: number; y: number; width: number; height: number }
  contextElement?: HTMLElement
}

export interface ManagedPopover {
  hide: () => void
  destroy: () => void
  updateReference: (referenceElement?: HTMLElement, coordinates?: VirtualCoordinates) => void
}

export type ControllerState = { kind: 'idle' } | { kind: 'mounted'; popoverKind: PopoverKind }

export interface PopoverController {
  adopt(popover: ManagedPopover, kind: PopoverKind): () => void
  close(): void
  reposition(referenceElement?: HTMLElement, coordinates?: VirtualCoordinates): void
  getState(): ControllerState
  subscribe(listener: (state: ControllerState) => void): () => void
}

export function createPopoverController(): PopoverController {
  let current: { popover: ManagedPopover; kind: PopoverKind } | null = null
  const listeners = new Set<(state: ControllerState) => void>()

  const snapshot = (): ControllerState =>
    current === null ? { kind: 'idle' } : { kind: 'mounted', popoverKind: current.kind }

  const notify = (): void => {
    const state = snapshot()
    listeners.forEach((listener) => listener(state))
  }

  return {
    adopt(popover, kind) {
      if (current?.popover === popover) {
        current = { popover, kind }
        notify()
        return () => {
          if (current?.popover === popover) {
            current = null
            notify()
          }
        }
      }
      const previous = current
      current = { popover, kind }
      previous?.popover.destroy()
      notify()
      return () => {
        if (current?.popover === popover) {
          current = null
          notify()
        }
      }
    },
    close() {
      if (current === null) return
      const { popover } = current
      current = null
      popover.hide()
      notify()
    },
    reposition(referenceElement, coordinates) {
      current?.popover.updateReference(referenceElement, coordinates)
    },
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

let defaultController: PopoverController = createPopoverController()

export function getDefaultController(): PopoverController {
  return defaultController
}

export function setDefaultController(controller: PopoverController): void {
  defaultController = controller
}

export function resetDefaultController(): void {
  defaultController = createPopoverController()
}
