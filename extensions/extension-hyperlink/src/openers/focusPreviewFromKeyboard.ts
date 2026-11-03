import { focusables, getDefaultController } from '../floating-popover'

/**
 * Moves focus into a preview opened from the keyboard, and gives it back once on close.
 * It gives focus back only when focus would be lost: on `body` or still inside the closed
 * preview. It never takes back focus the user moved, and it waits while another popover mounts.
 */
export function focusPreviewFromKeyboard(restoreFocus: () => void): void {
  const controller = getDefaultController()
  const state = controller.getState()
  if (state.kind !== 'mounted' || state.popoverKind !== 'preview') return
  const root = state.element
  // The first focus follows the Tab rule, so it never lands on a hidden or inert control.
  const target =
    root.querySelector<HTMLElement>('[data-popover-autofocus]') ?? focusables(root)[0] ?? root
  target.focus({ preventScroll: true })

  const unsubscribe = controller.subscribe((next) => {
    if (next.kind === 'mounted' && next.element === root) return
    unsubscribe()
    // A microtask lets a replacing opener (Edit, Back) adopt before the check.
    queueMicrotask(() => {
      if (controller.getState().kind !== 'idle') return
      const active = document.activeElement
      if (!active || active === document.body || root.contains(active)) restoreFocus()
    })
  })
}
