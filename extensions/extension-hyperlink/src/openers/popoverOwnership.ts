import type { Editor } from '@tiptap/core'

import { getDefaultController, type Popover } from '../floating-popover'

// The popover controller is a process-wide singleton, so it can't tell which
// editor owns the popover it holds. Track the `{ editor, popover }` pair so
// the mark's `onDestroy` closes only the popover this editor opened — never
// a sibling's, never one a host adopted by hand after ours closed.
let owned: { editor: Editor; popover: Popover } | null = null
let unsubscribe: (() => void) | null = null

/** Record the editor and popover instance behind the popover an opener just adopted. */
export function setActivePopoverOwner(editor: Editor, popover: Popover): void {
  owned = { editor, popover }
  watchForRelease()
}

// Clear ownership the moment the controller stops holding our popover
// (outside click, Escape, replacement adopt) so stale ownership can never
// close a popover we didn't open. Lazy: subscribed only while owning.
function watchForRelease(): void {
  if (unsubscribe) return
  unsubscribe = getDefaultController().subscribe((state) => {
    if (owned && state.kind === 'mounted' && state.element === owned.popover.element) return
    owned = null
    unsubscribe?.()
    unsubscribe = null
  })
}

/** Close the open popover only when `editor` owns it. Called from the mark's `onDestroy`. */
export function closeOwnedPopover(editor: Editor): void {
  if (!owned || owned.editor !== editor) return
  const { popover } = owned
  owned = null
  unsubscribe?.()
  unsubscribe = null
  const controller = getDefaultController()
  const state = controller.getState()
  if (state.kind === 'mounted' && state.element === popover.element) {
    controller.close()
  }
}
