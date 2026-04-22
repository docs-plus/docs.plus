// Hyperlink UI Controller — single owner for the floating popover
// lifecycle (preview / edit / create). Storage-agnostic: it does NOT
// call into `@floating-ui/dom`; `createFloatingToolbar` mounts and
// hands the instance to `register()`.
//
// Replaces a module-level `currentToolbar` global with an inspectable
// state machine + `surface` tag, so tests and hosts can answer
// "what's open?" without DOM spelunking.

/** Tag for the currently-mounted surface; mirrored to `data-hyperlink-surface` for CSS / e2e. */
export type SurfaceKind = 'preview' | 'edit' | 'create' | 'unknown'

/** Subset of `FloatingToolbarInstance` the controller uses; decoupled to allow BYO mount strategies. */
export interface ManagedSurface {
  hide: () => void
  destroy: () => void
  /** Re-anchor an already-mounted surface (called on doc-selection moves). */
  updateReference: (referenceElement?: HTMLElement, coordinates?: VirtualCoordinates) => void
}

export type VirtualCoordinates = {
  getBoundingClientRect: () => { x: number; y: number; width: number; height: number }
  contextElement?: HTMLElement
}

export type ControllerState = { kind: 'idle' } | { kind: 'mounted'; surface: SurfaceKind }

export interface HyperlinkUIController {
  /** Take ownership of `instance`; destroys the previous one. Returned callback drops state to `idle`. */
  register(instance: ManagedSurface, surface?: SurfaceKind): () => void
  /** Hide the currently-mounted surface; no-op when idle. */
  close(): void
  /** Reposition against a new reference (legacy `updateCurrentToolbarPosition` signature). */
  reposition(referenceElement?: HTMLElement, coordinates?: VirtualCoordinates): void
  getState(): ControllerState
  /** Observe lifecycle changes; returns the unsubscribe fn. */
  subscribe(listener: (state: ControllerState) => void): () => void
}

/** Build a fresh controller. Production reuses the module default via `getDefaultController()`. */
export function createHyperlinkUIController(): HyperlinkUIController {
  let current: { instance: ManagedSurface; surface: SurfaceKind } | null = null
  const listeners = new Set<(state: ControllerState) => void>()

  const snapshot = (): ControllerState =>
    current === null ? { kind: 'idle' } : { kind: 'mounted', surface: current.surface }

  const notify = (): void => {
    const state = snapshot()
    listeners.forEach((listener) => listener(state))
  }

  return {
    register(instance, surface = 'unknown') {
      // Idempotency guard: re-register with the same instance is a surface-tag
      // update — without this, the replacement path would destroy our only instance.
      if (current?.instance === instance) {
        current = { instance, surface }
        notify()
        return () => {
          if (current?.instance === instance) {
            current = null
            notify()
          }
        }
      }

      // Capture new state BEFORE destroying old, so re-entrant unregister calls
      // from the old `destroy()` (its own onHide) see the new state, not a stale one.
      const previous = current
      current = { instance, surface }
      previous?.instance.destroy()
      notify()

      return () => {
        // Only drop to idle if WE are still the owner — a later `register` may have replaced us.
        if (current?.instance === instance) {
          current = null
          notify()
        }
      }
    },
    close() {
      if (current === null) return
      const { instance } = current
      current = null
      // `hide` not `destroy` — `destroy` is reserved for replacement-time cleanup.
      instance.hide()
      notify()
    },
    reposition(referenceElement, coordinates) {
      current?.instance.updateReference(referenceElement, coordinates)
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

let defaultController: HyperlinkUIController = createHyperlinkUIController()

export function getDefaultController(): HyperlinkUIController {
  return defaultController
}

/** Test-only: replace the module-level controller. */
export function setDefaultController(controller: HyperlinkUIController): void {
  defaultController = controller
}

/** Test-only: reset the module-level controller to a fresh instance. */
export function resetDefaultController(): void {
  defaultController = createHyperlinkUIController()
}
