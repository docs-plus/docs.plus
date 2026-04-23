// Extension-agnostic single-popover lifecycle owner. `adopt` takes
// ownership of a built popover (destroying the previous owner), `close`
// hides + idles, `reposition` re-anchors, `subscribe` observes
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

export type AdoptMetadata = {
  /** The popover's root element — what subscribers attach focus rings, scroll-freezes, or DOM observers to. */
  element: HTMLElement
  /** The anchor the popover is glued to — `null` for virtual-coords popovers (e.g. selection-anchored create). */
  referenceElement: HTMLElement | null
}

export type ControllerState =
  | { kind: 'idle' }
  | ({ kind: 'mounted'; popoverKind: PopoverKind } & AdoptMetadata)

export interface PopoverController {
  adopt(popover: ManagedPopover, kind: PopoverKind, metadata: AdoptMetadata): () => void
  close(): void
  reposition(referenceElement?: HTMLElement, coordinates?: VirtualCoordinates): void
  getState(): ControllerState
  subscribe(listener: (state: ControllerState) => void): () => void
}

export function createPopoverController(): PopoverController {
  let current: { popover: ManagedPopover; kind: PopoverKind; metadata: AdoptMetadata } | null = null
  const listeners = new Set<(state: ControllerState) => void>()

  const snapshot = (): ControllerState =>
    current === null
      ? { kind: 'idle' }
      : {
          kind: 'mounted',
          popoverKind: current.kind,
          element: current.metadata.element,
          referenceElement: current.metadata.referenceElement
        }

  const notify = (): void => {
    const state = snapshot()
    listeners.forEach((listener) => listener(state))
  }

  return {
    adopt(popover, kind, metadata) {
      if (current?.popover === popover) {
        current = { popover, kind, metadata }
        notify()
        return () => {
          if (current?.popover === popover) {
            current = null
            notify()
          }
        }
      }
      const previous = current
      current = { popover, kind, metadata }
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
