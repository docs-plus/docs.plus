/**
 * Unit tests for the Hyperlink UI Controller — verifies the singleton
 * replacement contract, state transitions, subscriber notification,
 * and the unregister callback that lets surfaces dismiss themselves
 * out-of-band without leaving stale state behind.
 *
 * No DOM is involved: the controller speaks to a `ManagedSurface`
 * interface, so tests inject a fake surface that records calls.
 */
import { describe, expect, it, mock } from 'bun:test'

import {
  type ControllerState,
  createHyperlinkUIController,
  type ManagedSurface,
  type SurfaceKind
} from '../index'

/** Build a recording surface; counters expose what the controller did to it. */
function makeSurface(): ManagedSurface & {
  hideCalls: number
  destroyCalls: number
  updateCalls: number
} {
  const state = { hideCalls: 0, destroyCalls: 0, updateCalls: 0 }
  return {
    hide: () => {
      state.hideCalls += 1
    },
    destroy: () => {
      state.destroyCalls += 1
    },
    updateReference: () => {
      state.updateCalls += 1
    },
    get hideCalls() {
      return state.hideCalls
    },
    get destroyCalls() {
      return state.destroyCalls
    },
    get updateCalls() {
      return state.updateCalls
    }
  }
}

describe('createHyperlinkUIController', () => {
  it('starts in idle state', () => {
    const controller = createHyperlinkUIController()
    expect(controller.getState()).toEqual({ kind: 'idle' })
  })

  describe('register', () => {
    it('transitions to mounted with the supplied surface kind', () => {
      const controller = createHyperlinkUIController()
      const surface = makeSurface()
      controller.register(surface, 'preview')
      expect(controller.getState()).toEqual({ kind: 'mounted', surface: 'preview' })
    })

    it('defaults the surface kind to "unknown" when omitted', () => {
      const controller = createHyperlinkUIController()
      controller.register(makeSurface())
      expect(controller.getState()).toEqual({ kind: 'mounted', surface: 'unknown' })
    })

    it('destroys the previously-mounted surface on replacement', () => {
      // Singleton-replacement contract: any previous owner is torn
      // down before the new one takes over. Without this, a click on
      // a different link while another popover is open would leave
      // both mounted at once.
      const controller = createHyperlinkUIController()
      const first = makeSurface()
      const second = makeSurface()
      controller.register(first, 'preview')
      controller.register(second, 'edit')
      expect(first.destroyCalls).toBe(1)
      expect(second.destroyCalls).toBe(0)
      expect(controller.getState()).toEqual({ kind: 'mounted', surface: 'edit' })
    })

    it('is idempotent when re-registering the same instance — no destroy fires', () => {
      // Re-registration is an idempotent surface-tag refresh, not a
      // teardown. Without this guard the singleton-replacement path
      // would destroy the only instance we have (since
      // `previous === instance`) and leave a dangling, unusable
      // reference in `current`.
      const controller = createHyperlinkUIController()
      const surface = makeSurface()
      controller.register(surface, 'preview')
      controller.register(surface, 'edit')
      expect(surface.destroyCalls).toBe(0)
      expect(controller.getState()).toEqual({ kind: 'mounted', surface: 'edit' })
    })

    it('returns an unregister callback that flips state to idle when the surface dismisses itself', () => {
      const controller = createHyperlinkUIController()
      const surface = makeSurface()
      const unregister = controller.register(surface, 'create')
      unregister()
      expect(controller.getState()).toEqual({ kind: 'idle' })
    })

    it('the unregister callback is a no-op once a newer surface has taken over', () => {
      // Critical re-entrancy guard: the OLD surface's hide() will
      // fire its unregister AFTER `register` has already swapped in
      // the NEW owner. Letting it transition to idle would erase the
      // new state.
      const controller = createHyperlinkUIController()
      const first = makeSurface()
      const second = makeSurface()
      const firstUnregister = controller.register(first, 'preview')
      controller.register(second, 'edit')
      firstUnregister()
      expect(controller.getState()).toEqual({ kind: 'mounted', surface: 'edit' })
    })
  })

  describe('close', () => {
    it('hides the registered surface and transitions to idle', () => {
      const controller = createHyperlinkUIController()
      const surface = makeSurface()
      controller.register(surface, 'preview')
      controller.close()
      expect(surface.hideCalls).toBe(1)
      expect(controller.getState()).toEqual({ kind: 'idle' })
    })

    it('is a no-op when idle', () => {
      const controller = createHyperlinkUIController()
      expect(() => controller.close()).not.toThrow()
      expect(controller.getState()).toEqual({ kind: 'idle' })
    })

    it('does NOT destroy the surface (only hide) — destroy is reserved for replacement', () => {
      // `close` mirrors the legacy `hideCurrentToolbar()` semantics:
      // dismiss the popover but leave the instance intact for the
      // host's own teardown / animation cleanup. Calling `destroy`
      // here would invalidate the instance reference downstream code
      // may still hold (e.g. the popover's own onHide cleanup).
      const controller = createHyperlinkUIController()
      const surface = makeSurface()
      controller.register(surface, 'preview')
      controller.close()
      expect(surface.destroyCalls).toBe(0)
    })
  })

  describe('reposition', () => {
    it('forwards to the registered surface', () => {
      const controller = createHyperlinkUIController()
      const surface = makeSurface()
      controller.register(surface, 'preview')
      controller.reposition()
      expect(surface.updateCalls).toBe(1)
    })

    it('is a no-op when idle', () => {
      const controller = createHyperlinkUIController()
      expect(() => controller.reposition()).not.toThrow()
    })
  })

  describe('subscribe', () => {
    it('emits state on register / close transitions', () => {
      const controller = createHyperlinkUIController()
      const seen: ControllerState[] = []
      controller.subscribe((s) => seen.push(s))

      controller.register(makeSurface(), 'preview')
      controller.register(makeSurface(), 'edit')
      controller.close()

      expect(seen).toEqual([
        { kind: 'mounted', surface: 'preview' },
        { kind: 'mounted', surface: 'edit' },
        { kind: 'idle' }
      ])
    })

    it('emits a transition when the surface dismisses itself via unregister', () => {
      const controller = createHyperlinkUIController()
      const seen: ControllerState[] = []
      controller.subscribe((s) => seen.push(s))

      const unregister = controller.register(makeSurface(), 'create')
      unregister()

      expect(seen).toEqual([{ kind: 'mounted', surface: 'create' }, { kind: 'idle' }])
    })

    it('returns an unsubscribe function that stops further deliveries', () => {
      const controller = createHyperlinkUIController()
      const listener = mock<(state: ControllerState) => void>(() => undefined)
      const unsubscribe = controller.subscribe(listener)

      controller.register(makeSurface(), 'preview')
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
      controller.close()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it.each<SurfaceKind>(['preview', 'edit', 'create', 'unknown'])(
      'reports surface kind = %s',
      (kind) => {
        const controller = createHyperlinkUIController()
        controller.register(makeSurface(), kind)
        expect(controller.getState()).toEqual({ kind: 'mounted', surface: kind })
      }
    )
  })
})
