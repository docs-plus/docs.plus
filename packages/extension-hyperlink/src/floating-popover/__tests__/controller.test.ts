// packages/extension-hyperlink/src/floating-popover/__tests__/controller.test.ts
import { describe, expect, it, mock } from 'bun:test'

import {
  type ControllerState,
  createPopoverController,
  type ManagedPopover,
  type PopoverKind
} from '../controller'

function makePopover(): ManagedPopover & {
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

describe('createPopoverController', () => {
  it('starts in idle state', () => {
    expect(createPopoverController().getState()).toEqual({ kind: 'idle' })
  })

  describe('adopt', () => {
    it('transitions to mounted with the supplied kind', () => {
      const controller = createPopoverController()
      controller.adopt(makePopover(), 'preview')
      expect(controller.getState()).toEqual({ kind: 'mounted', popoverKind: 'preview' })
    })

    it('destroys the previously-adopted popover on replacement', () => {
      const controller = createPopoverController()
      const first = makePopover()
      const second = makePopover()
      controller.adopt(first, 'preview')
      controller.adopt(second, 'edit')
      expect(first.destroyCalls).toBe(1)
      expect(second.destroyCalls).toBe(0)
      expect(controller.getState()).toEqual({ kind: 'mounted', popoverKind: 'edit' })
    })

    it('is idempotent when re-adopting the same instance — no destroy fires, kind updates', () => {
      const controller = createPopoverController()
      const popover = makePopover()
      controller.adopt(popover, 'preview')
      controller.adopt(popover, 'edit')
      expect(popover.destroyCalls).toBe(0)
      expect(controller.getState()).toEqual({ kind: 'mounted', popoverKind: 'edit' })
    })

    it('returns an unregister callback that flips state to idle', () => {
      const controller = createPopoverController()
      const unregister = controller.adopt(makePopover(), 'create')
      unregister()
      expect(controller.getState()).toEqual({ kind: 'idle' })
    })

    it('the unregister callback is a no-op once a newer popover has taken over', () => {
      const controller = createPopoverController()
      const first = makePopover()
      const second = makePopover()
      const firstUnregister = controller.adopt(first, 'preview')
      controller.adopt(second, 'edit')
      firstUnregister()
      expect(controller.getState()).toEqual({ kind: 'mounted', popoverKind: 'edit' })
    })

    it('accepts arbitrary string kinds (open-string union for future extensions)', () => {
      const controller = createPopoverController()
      controller.adopt(makePopover(), 'media' as PopoverKind)
      expect(controller.getState()).toEqual({ kind: 'mounted', popoverKind: 'media' })
    })
  })

  describe('close', () => {
    it('hides the adopted popover and transitions to idle', () => {
      const controller = createPopoverController()
      const popover = makePopover()
      controller.adopt(popover, 'preview')
      controller.close()
      expect(popover.hideCalls).toBe(1)
      expect(controller.getState()).toEqual({ kind: 'idle' })
    })

    it('is a no-op when idle', () => {
      const controller = createPopoverController()
      expect(() => controller.close()).not.toThrow()
      expect(controller.getState()).toEqual({ kind: 'idle' })
    })

    it('does NOT destroy the popover (only hide)', () => {
      const controller = createPopoverController()
      const popover = makePopover()
      controller.adopt(popover, 'preview')
      controller.close()
      expect(popover.destroyCalls).toBe(0)
    })
  })

  describe('reposition', () => {
    it('forwards to the adopted popover', () => {
      const controller = createPopoverController()
      const popover = makePopover()
      controller.adopt(popover, 'preview')
      controller.reposition()
      expect(popover.updateCalls).toBe(1)
    })

    it('is a no-op when idle', () => {
      const controller = createPopoverController()
      expect(() => controller.reposition()).not.toThrow()
    })
  })

  describe('subscribe', () => {
    it('emits state on adopt / close transitions', () => {
      const controller = createPopoverController()
      const seen: ControllerState[] = []
      controller.subscribe((s) => seen.push(s))
      controller.adopt(makePopover(), 'preview')
      controller.adopt(makePopover(), 'edit')
      controller.close()
      expect(seen).toEqual([
        { kind: 'mounted', popoverKind: 'preview' },
        { kind: 'mounted', popoverKind: 'edit' },
        { kind: 'idle' }
      ])
    })

    it('emits a transition when the popover dismisses itself via unregister', () => {
      const controller = createPopoverController()
      const seen: ControllerState[] = []
      controller.subscribe((s) => seen.push(s))
      const unregister = controller.adopt(makePopover(), 'create')
      unregister()
      expect(seen).toEqual([{ kind: 'mounted', popoverKind: 'create' }, { kind: 'idle' }])
    })

    it('returns an unsubscribe function that stops further deliveries', () => {
      const controller = createPopoverController()
      const listener = mock<(state: ControllerState) => void>(() => undefined)
      const unsubscribe = controller.subscribe(listener)
      controller.adopt(makePopover(), 'preview')
      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
      controller.close()
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })
})
