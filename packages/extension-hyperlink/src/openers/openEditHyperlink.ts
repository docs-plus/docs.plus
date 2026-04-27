import type { Editor } from '@tiptap/core'

import { createPopover, getDefaultController } from '../floating-popover'
import type { EditHyperlinkOptions } from '../hyperlink'
import editHyperlinkPopover from '../popovers/editHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'
import { findLiveEquivalentAnchor } from './liveAnchor'

const OFFSCREEN_COORD_PX = -9999

// Module-local stash for the prebuilt edit popover's Back button.
// Cleared whenever the controller transitions AWAY FROM an already-
// established edit kind (close, replaced by a non-edit popover) so a
// stale stash never leaks into a future re-open via
// `consumeStashedEditOptions()`. The "already-established" guard
// matters because `createPopover` self-adopts under the transient
// `'unknown'` kind before the opener tags it as `'edit'`; without the
// guard, that mid-flight notification would wipe the stash we just
// wrote (regression: prebuilt edit popover's Back button would close
// instead of returning to preview).
let stashed: { editor: Editor; opts: EditHyperlinkOptions } | null = null
let unsubscribe: (() => void) | null = null
let wasEdit = false

function ensureSubscription(): void {
  if (unsubscribe) return
  unsubscribe = getDefaultController().subscribe((state) => {
    if (state.kind === 'mounted' && state.popoverKind === 'edit') {
      wasEdit = true
      return
    }
    if (wasEdit) {
      stashed = null
      wasEdit = false
    }
  })
}

/** Internal — read and clear the stashed options. Used by the prebuilt edit popover's Back button. */
export function consumeStashedEditOptions(): {
  editor: Editor
  opts: EditHyperlinkOptions
} | null {
  const value = stashed
  stashed = null
  return value
}

/** Test-only — drops the controller subscription so `resetDefaultController()` truly resets. */
export function _resetEditOpenerSubscription(): void {
  unsubscribe?.()
  unsubscribe = null
  stashed = null
  wasEdit = false
}

/**
 * Open the edit popover anchored to a hyperlink. Stashes `opts` so the
 * prebuilt Back button can re-open the preview without consumer wiring.
 */
export function openEditHyperlink(editor: Editor, opts: EditHyperlinkOptions): void {
  ensureSubscription()
  const { popovers } = getHyperlinkOptions(editor, 'openEditHyperlink')
  const factory = popovers.editHyperlink ?? editHyperlinkPopover
  const content = factory(opts)
  if (!content) return
  let referenceLink = findLiveEquivalentAnchor(editor, opts.link, opts.nodePos)
  let hideQueued = false
  const popover = createPopover({
    coordinates: {
      getBoundingClientRect: () => {
        referenceLink = referenceLink
          ? findLiveEquivalentAnchor(editor, referenceLink, opts.nodePos)
          : null
        if (!referenceLink) {
          if (!hideQueued) {
            hideQueued = true
            queueMicrotask(() => popover.hide())
          }
          return { x: OFFSCREEN_COORD_PX, y: OFFSCREEN_COORD_PX, width: 0, height: 0 }
        }
        const rect = referenceLink.getBoundingClientRect()
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      },
      contextElement: editor.view.dom
    },
    content,
    placement: 'bottom',
    showArrow: true
  })
  getDefaultController().adopt(popover, 'edit', {
    element: popover.element,
    referenceElement: null
  })
  // Stash AFTER the `'edit'` adopt so the transient `'unknown'`
  // notification from `createPopover`'s self-adopt never sees a
  // populated stash to clear (the subscriber's `wasEdit` guard makes
  // that defensive too — belt-and-braces).
  stashed = { editor, opts }
  popover.show()
}
