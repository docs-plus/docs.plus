import type { Editor } from '@tiptap/core'

import { createPopover, getDefaultController } from '../floating-popover'
import type { EditHyperlinkOptions } from '../hyperlink'
import editHyperlinkPopover from '../popovers/editHyperlinkPopover'
import { getHyperlinkOptions } from './getHyperlinkOptions'
import { findLiveEquivalentAnchor } from './liveAnchor'

const OFFSCREEN_COORD_PX = -9999

// Stash for the prebuilt edit popover's Back button, cleared only when leaving
// an *established* edit. `createPopover` self-adopts as transient `'unknown'`
// before the opener tags `'edit'`; an unguarded clear on that notification
// wipes the just-written stash and Back closes instead of returning to preview.
let stashed: { editor: Editor; opts: EditHyperlinkOptions } | null = null
let unsubscribe: (() => void) | null = null
let wasEdit = false

// Lazily subscribe only while an edit popover is live, and tear the
// subscription down once the controller idles — previously the module-level
// subscription was created on first edit and never released (it outlived the
// popover and survived `resetDefaultController()`).
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
    if (state.kind === 'idle') {
      unsubscribe?.()
      unsubscribe = null
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
  // Stash after the `'edit'` adopt so the transient `'unknown'` notification
  // never sees a populated stash to clear (the `wasEdit` guard is redundant
  // insurance for that ordering).
  stashed = { editor, opts }
  popover.show()
}
