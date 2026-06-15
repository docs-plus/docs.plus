import { getKitStorage } from '../kitStorage'
import { createMediaToolbar } from './createMediaToolbar'
import { closeToolbarPopover } from './menu'
import type { MediaToolbarFactory, MediaToolbarOptions } from './types'

// Covers the 80ms exit fade; toolbars mid-exit are excluded from reuse.
const CLOSE_REMOVE_DELAY_MS = 100

function existingToolbar(wrapper: HTMLElement): HTMLElement | null {
  return wrapper.querySelector<HTMLElement>(':scope > .media-toolbar:not([data-hm-closing])')
}

/** Mount the toolbar inside the media wrapper (absolute top-right). `null` ⇒ host surface. */
export function openMediaToolbar(
  options: MediaToolbarOptions,
  factory?: MediaToolbarFactory
): HTMLElement | null {
  const reused = existingToolbar(options.target)
  if (reused) return reused

  const resolved: MediaToolbarFactory =
    factory ?? getKitStorage(options.editor).mediaToolbar ?? createMediaToolbar

  const content = resolved(options)
  if (!content) return null

  // Append first, then flag in the next frame — flagging before first paint
  // skips the enter fade entirely. The isConnected guard keeps a close() that
  // raced in between from being re-flagged.
  options.target.append(content)
  requestAnimationFrame(() => {
    if (content.isConnected && !content.dataset.hmClosing) {
      options.target.classList.add('hm-has-toolbar')
    }
  })
  return content
}

/** Remove the in-chrome toolbar and any open menu popover. */
export function closeMediaToolbar(wrapper?: HTMLElement | null): void {
  closeToolbarPopover()
  const root = wrapper ?? document
  // The document-wide fallback filters on [data-node-type] so host-page elements that
  // merely share the `.media-toolbar` class are never touched.
  const selector = wrapper ? '.media-toolbar' : '.media-toolbar[data-node-type]'
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.closest('.hm-has-toolbar')?.classList.remove('hm-has-toolbar')
    // Deferred removal lets the exit fade play; the marker keeps a reopen from
    // reusing a toolbar that is already on its way out.
    el.dataset.hmClosing = 'true'
    setTimeout(() => el.remove(), CLOSE_REMOVE_DELAY_MS)
  })
}
